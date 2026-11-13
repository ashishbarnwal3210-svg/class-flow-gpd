-- Give the requested owner account the initial administrator role.
do $$
declare root_admin uuid;
begin
  select id into root_admin from public.profiles where lower(username)='ashish_17' and deleted_at is null;
  if root_admin is null then raise exception 'Bootstrap account Ashish_17 was not found'; end if;
  insert into public.user_roles(user_id,role,assigned_by) values(root_admin,'admin',root_admin)
    on conflict(user_id) do update set role='admin',assigned_by=excluded.assigned_by;
  insert into public.audit_logs(actor_id,action,target_type,target_id,after_state)
    values(root_admin,'bootstrap_admin_grant','profile',root_admin,jsonb_build_object('role','admin','username','ashish_17'));
end $$;

-- Role changes are only performed through this admin-checked, audited RPC.
create or replace function public.set_user_role(target_user uuid, target_role text, permissions text[] default '{}'::text[])
returns void language plpgsql security definer set search_path=public as $$
declare
  requested_role text := lower(trim(target_role));
  old_role text;
  permission_list text[];
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if target_user is null or target_user=auth.uid() then raise exception 'choose another campus member'; end if;
  if requested_role not in ('student','subadmin','admin') then raise exception 'invalid role'; end if;
  if not exists(select 1 from public.profiles where id=target_user and deleted_at is null) then raise exception 'target profile not found'; end if;

  perform pg_advisory_xact_lock(hashtext('classflow-role-administration'));
  select role into old_role from public.user_roles where user_id=target_user for update;
  if old_role='admin' and requested_role<>'admin' and (select count(*) from public.user_roles where role='admin')<=1 then
    raise exception 'cannot remove the last administrator';
  end if;

  permission_list := array(
    select distinct p from unnest(coalesce(permissions,'{}'::text[])) as p
    where p in ('resources.manage','resources.edit','resources.delete','notices.manage','academic.manage','reports.manage','groups.manage','messages.moderate','calls.manage')
  );
  delete from public.user_permissions where user_id=target_user;
  insert into public.user_roles(user_id,role,assigned_by) values(target_user,requested_role,auth.uid())
    on conflict(user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by;
  if requested_role='subadmin' and cardinality(permission_list)>0 then
    insert into public.user_permissions(user_id,permission,granted_by)
      select target_user,p,auth.uid() from unnest(permission_list) as p;
  end if;
  insert into public.audit_logs(actor_id,action,target_type,target_id,before_state,after_state)
    values(auth.uid(),'user_role_update','profile',target_user,jsonb_build_object('role',old_role),jsonb_build_object('role',requested_role,'permissions',permission_list));
end $$;
revoke all on function public.set_user_role(uuid,text,text[]) from public,anon;
grant execute on function public.set_user_role(uuid,text,text[]) to authenticated;

-- Prevent clients from bypassing the RPC's self-change/last-admin checks and audit trail.
revoke insert,update,delete on public.user_roles from authenticated;
revoke insert,update,delete on public.user_permissions from authenticated;
