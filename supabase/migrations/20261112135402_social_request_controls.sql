-- Permit a connection to be removed cleanly, while restricting transitions to the two participants.
alter table public.friend_requests drop constraint if exists friend_requests_status_check;
alter table public.friend_requests add constraint friend_requests_status_check check(status in ('pending','accepted','rejected','cancelled'));
create or replace function public.guard_friend_request_transition() returns trigger language plpgsql set search_path=public as $$
begin
 if auth.uid()=old.recipient_id and old.status='pending' and new.status in ('accepted','rejected')
   and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id then return new; end if;
 if auth.uid()=old.sender_id and old.status='pending' and new.status='cancelled'
   and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id then return new; end if;
 if auth.uid() in (old.sender_id,old.recipient_id) and old.status='accepted' and new.status='cancelled'
   and new.sender_id=old.sender_id and new.recipient_id=old.recipient_id then return new; end if;
 raise exception 'not permitted to change this friend request';
end $$;
create policy "participants remove friendships" on public.friendships for delete to authenticated using(user_one=auth.uid() or user_two=auth.uid());
