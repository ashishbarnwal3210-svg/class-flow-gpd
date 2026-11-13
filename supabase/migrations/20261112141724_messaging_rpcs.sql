-- Keep inbox ordering aligned with recent activity.
create or replace function public.touch_conversation_on_message() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.conversations set updated_at=now() where id=new.conversation_id;
 return new;
end $$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages for each row execute function public.touch_conversation_on_message();

-- Transactional direct/group conversation creation. Both operations require accepted, unblocked campus connections.
create or replace function public.create_direct_conversation(target_user uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); cid uuid;
begin
 if actor is null then raise exception 'authentication required'; end if;
 if target_user is null or target_user=actor then raise exception 'choose another student'; end if;
 if not exists(select 1 from public.friendships f where f.user_one=least(actor,target_user) and f.user_two=greatest(actor,target_user)) then
   raise exception 'connect with this student before starting a conversation';
 end if;
 if exists(select 1 from public.user_blocks b where (b.blocker_id=actor and b.blocked_id=target_user) or (b.blocker_id=target_user and b.blocked_id=actor)) then
   raise exception 'conversation is unavailable';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor::text,target_user::text)||':'||greatest(actor::text,target_user::text),0));
 select c.id into cid from public.conversations c
 join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=actor
 join public.conversation_members other on other.conversation_id=c.id and other.user_id=target_user
 where c.kind='direct' and c.deleted_at is null
   and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
 order by c.updated_at desc limit 1;
 if cid is not null then return cid; end if;
 insert into public.conversations(kind,created_by) values('direct',actor) returning id into cid;
 insert into public.conversation_members(conversation_id,user_id,role) values(cid,actor,'owner'),(cid,target_user,'member');
 return cid;
end $$;
revoke all on function public.create_direct_conversation(uuid) from public,anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

create or replace function public.create_group_conversation(p_title text,p_description text default null,p_members uuid[] default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); cid uuid; gid uuid; member_list uuid[];
begin
 if actor is null then raise exception 'authentication required'; end if;
 if nullif(trim(p_title),'') is null or length(trim(p_title))>80 then raise exception 'group name must be 1–80 characters'; end if;
 member_list:=array(select distinct x from unnest(coalesce(p_members,'{}'::uuid[])) x where x is not null and x<>actor);
 if cardinality(member_list)>99 then raise exception 'a group can have at most 100 members'; end if;
 if exists(select 1 from unnest(member_list) requested(id) where not exists(
   select 1 from public.friendships f where f.user_one=least(actor,requested.id) and f.user_two=greatest(actor,requested.id)
 )) then raise exception 'groups may only include connected students'; end if;
 if exists(select 1 from public.user_blocks b where (b.blocker_id=actor and b.blocked_id=any(member_list)) or (b.blocked_id=actor and b.blocker_id=any(member_list))) then
   raise exception 'a selected member is unavailable';
 end if;
 insert into public.conversations(kind,title,created_by) values('group',trim(p_title),actor) returning id into cid;
 insert into public.groups(title,description,created_by,conversation_id) values(trim(p_title),nullif(trim(p_description),''),actor,cid) returning id into gid;
 insert into public.conversation_members(conversation_id,user_id,role) values(cid,actor,'owner');
 insert into public.group_members(group_id,user_id,role,added_by) values(gid,actor,'owner',actor);
 if cardinality(member_list)>0 then
   insert into public.conversation_members(conversation_id,user_id,role) select cid,x,'member' from unnest(member_list) x;
   insert into public.group_members(group_id,user_id,role,added_by) select gid,x,'member',actor from unnest(member_list) x;
 end if;
 return cid;
end $$;
revoke all on function public.create_group_conversation(text,text,uuid[]) from public,anon;
grant execute on function public.create_group_conversation(text,text,uuid[]) to authenticated;
