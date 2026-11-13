create or replace function public.can_edit_resource(resource_owner uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid()=resource_owner or public.has_permission('resources.manage') or public.has_permission('resources.edit')
$$;
create or replace function public.can_delete_resource(resource_owner uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid()=resource_owner or public.has_permission('resources.manage') or public.has_permission('resources.delete')
$$;

-- Keep the broad existing RLS guard for visibility, then restrict actual edits to edit/manage grants.
drop policy if exists "manage allowed resources" on public.resources;
create policy "edit allowed resources" on public.resources for update to authenticated using(public.can_manage_resource(uploaded_by)) with check(public.can_manage_resource(uploaded_by));
drop policy if exists "add files to managed resource" on public.resource_files;
create policy "add files to editable resource" on public.resource_files for insert to authenticated with check(uploaded_by=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and public.can_edit_resource(r.uploaded_by)));
drop policy if exists "manage files for managed resource" on public.resource_files;
create policy "edit files for editable resource" on public.resource_files for update to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by))) with check(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));

create or replace function public.guard_resource_edit_scope() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()<>old.uploaded_by and not public.is_admin() and not public.has_permission('resources.manage') and not public.has_permission('resources.edit') then
   if not public.has_permission('resources.delete') then raise exception 'resource edit permission required'; end if;
   if (to_jsonb(new)-array['deleted_at','deleted_by','updated_at']) is distinct from (to_jsonb(old)-array['deleted_at','deleted_by','updated_at']) then
     raise exception 'delete-only permission cannot change resource metadata';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists resources_guard_edit_scope on public.resources;
create trigger resources_guard_edit_scope before update on public.resources for each row execute function public.guard_resource_edit_scope();

create or replace function public.guard_resource_file_edit_scope() returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
 select uploaded_by into owner_id from public.resources where id=old.resource_id;
 if auth.uid()<>owner_id and not public.is_admin() and not public.has_permission('resources.manage') and not public.has_permission('resources.edit') then
   if not public.has_permission('resources.delete') then raise exception 'resource edit permission required'; end if;
   if (to_jsonb(new)-'deleted_at') is distinct from (to_jsonb(old)-'deleted_at') then raise exception 'delete-only permission cannot change file metadata'; end if;
 end if;
 return new;
end $$;
drop trigger if exists resource_files_guard_edit_scope on public.resource_files;
create trigger resource_files_guard_edit_scope before update on public.resource_files for each row execute function public.guard_resource_file_edit_scope();
