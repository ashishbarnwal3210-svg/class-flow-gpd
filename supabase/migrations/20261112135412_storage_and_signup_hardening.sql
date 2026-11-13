-- Bootstrap profile fields are mandatory at the database boundary, not just in the UI.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,auth,extensions as $$
declare m jsonb; bid uuid; sid uuid; generated_id text;
begin
 m:=new.raw_user_meta_data;
 if nullif(trim(m->>'full_name'),'') is null or nullif(trim(m->>'student_id'),'') is null or
    nullif(trim(m->>'board_roll_number'),'') is null or nullif(trim(m->>'mobile_number'),'') is null or
    nullif(trim(m->>'branch_name'),'') is null or nullif(trim(m->>'semester_name'),'') is null then
   raise exception 'Required ClassFlow account profile fields are missing';
 end if;
 select id into bid from public.branches where lower(name)=lower(m->>'branch_name') or lower(code)=lower(m->>'branch_name') limit 1;
 select id into sid from public.semesters where lower(name)=lower(m->>'semester_name') or number::text=regexp_replace(m->>'semester_name','[^0-9]','','g') limit 1;
 generated_id:='CF-'||nextval('public.classflow_id_seq')::text;
 insert into public.profiles(id,classflow_id,full_name,branch_id,semester_id) values(new.id,generated_id,trim(m->>'full_name'),bid,sid);
 insert into public.profile_private(id,student_id,board_roll_number,mobile_number,email) values(new.id,trim(m->>'student_id'),trim(m->>'board_roll_number'),trim(m->>'mobile_number'),new.email);
 insert into public.user_roles(user_id,role) values(new.id,'student');
 return new;
end $$;

-- UI uses soft deletion for resource records and file rows. Hard deletion is reserved for Admin-only recovery operations.
drop policy if exists "soft delete allowed resources" on public.resources;
create policy "admin hard delete resources" on public.resources for delete to authenticated using(public.is_admin());
drop policy if exists "delete files for managed resource" on public.resource_files;
create policy "admin hard delete resource file rows" on public.resource_files for delete to authenticated using(public.is_admin());
drop policy if exists "delete managed resource objects" on storage.objects;
create policy "delete own uploaded object or admin managed object" on storage.objects for delete to authenticated using(
 bucket_id='classflow-resources' and (
   (storage.foldername(name))[1]=auth.uid()::text or
   exists(select 1 from public.resource_files f join public.resources r on r.id=f.resource_id where f.storage_path=name and (public.is_admin() or public.has_permission('resources.delete')))
 )
);
