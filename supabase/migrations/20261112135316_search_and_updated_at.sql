-- Hybrid retrieval RPC. The Edge Function calls this with the service-role key after authenticating a signed-in student.
create or replace function public.hybrid_resource_search(
  query_embedding extensions.vector(1536),
  query_text text,
  result_limit integer default 12,
  branch_filter uuid default null,
  semester_filter uuid default null,
  subject_filter uuid default null,
  category_filter text default null
) returns table (
  chunk_id uuid, resource_id uuid, file_id uuid, chunk_text text, chunk_index integer,
  resource_title text, resource_category text, resource_description text, resource_created_at timestamptz,
  uploader_name text, subject_name text, branch_name text, semester_name text, similarity double precision
) language plpgsql security definer set search_path=public,extensions as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  return query
  with candidates as (
    select dc.id as cid, dc.resource_id as rid, dc.file_id as fid, dc.content as body, dc.chunk_index as ci,
      r.title as rtitle, r.category as rcategory, r.description as rdescription, r.created_at as rcreated,
      p.full_name as pname, s.name as sname, b.name as bname, sem.name as semname,
      case when dc.embedding is not null and query_embedding is not null then 1 - (dc.embedding <=> query_embedding) else 0 end as vector_score,
      case when nullif(trim(query_text),'') is not null then ts_rank_cd(dc.search_tsv, websearch_to_tsquery('english',query_text)) else 0 end as text_score
    from public.document_chunks dc
    join public.resources r on r.id=dc.resource_id
    join public.profiles p on p.id=r.uploaded_by
    join public.subjects s on s.id=r.subject_id
    join public.branches b on b.id=r.branch_id
    join public.semesters sem on sem.id=r.semester_id
    where r.is_published and r.deleted_at is null
      and (branch_filter is null or r.branch_id=branch_filter)
      and (semester_filter is null or r.semester_id=semester_filter)
      and (subject_filter is null or r.subject_id=subject_filter)
      and (category_filter is null or r.category=category_filter)
      and (query_embedding is null or dc.embedding is null or dc.embedding <=> query_embedding < 0.75
           or (nullif(trim(query_text),'') is not null and dc.search_tsv @@ websearch_to_tsquery('english',query_text)))
  )
  select c.cid,c.rid,c.fid,c.body,c.ci,c.rtitle,c.rcategory,c.rdescription,c.rcreated,c.pname,c.sname,c.bname,c.semname,
    (0.62*c.vector_score + 0.38*least(c.text_score,1.0))::double precision
  from candidates c order by (0.62*c.vector_score + 0.38*least(c.text_score,1.0)) desc limit least(greatest(result_limit,1),30);
end $$;
revoke all on function public.hybrid_resource_search(extensions.vector,text,integer,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.hybrid_resource_search(extensions.vector,text,integer,uuid,uuid,uuid,text) to service_role;

-- Convenience admin RPC for assigning a least-privilege Subadmin role. Students cannot call it.
create or replace function public.set_subadmin_permissions(target_user uuid, permissions text[]) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'administrator access required'; end if;
  if target_user=auth.uid() then raise exception 'use a separate admin to change your own role'; end if;
  insert into public.user_roles(user_id,role,assigned_by) values(target_user,'subadmin',auth.uid())
    on conflict(user_id) do update set role='subadmin',assigned_by=auth.uid();
  delete from public.role_permissions where role='subadmin';
  insert into public.role_permissions(role,permission,granted_by)
    select 'subadmin',p,auth.uid() from unnest(coalesce(permissions,'{}')) as p
    where p in ('resources.manage','resources.edit','resources.delete','notices.manage','academic.manage','reports.manage','groups.manage','messages.moderate','calls.manage');
  insert into public.audit_logs(actor_id,action,target_type,target_id,after_state)
    values(auth.uid(),'subadmin_permissions_update','profile',target_user,jsonb_build_object('permissions',permissions));
end $$;
revoke all on function public.set_subadmin_permissions(uuid,text[]) from public,anon;
grant execute on function public.set_subadmin_permissions(uuid,text[]) to authenticated;

-- Maintain timestamps on editable records.
do $$ declare tab text; begin
  foreach tab in array array['profiles','branches','subjects','resources','notices','assignments','conversations','groups'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',tab,tab);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',tab,tab);
  end loop;
end $$;
