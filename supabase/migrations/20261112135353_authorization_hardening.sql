-- Per-person Subadmin permissions prevent a grant to one moderator from becoming a global role grant.
create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check(permission in ('resources.manage','resources.edit','resources.delete','notices.manage','academic.manage','reports.manage','groups.manage','messages.moderate','calls.manage')),
  granted_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  primary key(user_id,permission)
);
alter table public.user_permissions enable row level security;
create policy "read own permissions or admin" on public.user_permissions for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "admin manage user permissions" on public.user_permissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.has_permission(permission_name text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin') or
 exists(select 1 from public.user_permissions p where p.user_id=auth.uid() and p.permission=permission_name)
$$;
create or replace function public.set_subadmin_permissions(target_user uuid, permissions text[]) returns void language plpgsql security definer set search_path=public as $$
declare permission_list text[];
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if target_user=auth.uid() then raise exception 'use a separate admin to change your own role'; end if;
  if not exists(select 1 from public.profiles where id=target_user) then raise exception 'target profile not found'; end if;
  permission_list:=coalesce(permissions,'{}');
  delete from public.user_permissions where user_id=target_user;
  if cardinality(permission_list)>0 then
    insert into public.user_permissions(user_id,permission,granted_by)
      select target_user,p,auth.uid() from unnest(permission_list) as p
      where p in ('resources.manage','resources.edit','resources.delete','notices.manage','academic.manage','reports.manage','groups.manage','messages.moderate','calls.manage');
  end if;
  insert into public.user_roles(user_id,role,assigned_by) values(target_user,'subadmin',auth.uid())
    on conflict(user_id) do update set role='subadmin',assigned_by=auth.uid();
  insert into public.audit_logs(actor_id,action,target_type,target_id,after_state)
    values(auth.uid(),'subadmin_permissions_update','profile',target_user,jsonb_build_object('permissions',permission_list));
end $$;

-- A recipient alone can accept/reject; the sender may only cancel a pending request.
create or replace function public.guard_friend_request_transition() returns trigger language plpgsql set search_path=public as $$
begin
 if auth.uid()=old.recipient_id and old.status='pending' and new.status in ('accepted','rejected')
   and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id then return new; end if;
 if auth.uid()=old.sender_id and old.status='pending' and new.status='cancelled'
   and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id then return new; end if;
 raise exception 'not permitted to change this friend request';
end $$;
drop trigger if exists friend_request_transition_guard on public.friend_requests;
create trigger friend_request_transition_guard before update on public.friend_requests for each row execute function public.guard_friend_request_transition();

create or replace function public.conversation_has_block(cid uuid, actor uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.conversation_members mine join public.user_blocks b on
   (b.blocker_id=actor and b.blocked_id=mine.user_id) or (b.blocker_id=mine.user_id and b.blocked_id=actor)
   where mine.conversation_id=cid and mine.user_id<>actor)
$$;
drop policy if exists "members send own messages" on public.messages;
create policy "members send own messages unless blocked" on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.is_conversation_member(conversation_id) and not public.conversation_has_block(conversation_id,auth.uid()));

-- Prevent profile and resource foreign-key edits to inconsistent academic classifications.
create policy "read own downloads or admin" on public.resource_downloads for select to authenticated using(user_id=auth.uid() or public.has_permission('resources.manage'));
