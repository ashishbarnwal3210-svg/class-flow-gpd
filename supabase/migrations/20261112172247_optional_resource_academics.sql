-- Resource classification is now optional; authors can put course context in the description.
alter table public.resources alter column branch_id drop not null;
alter table public.resources alter column semester_id drop not null;
alter table public.resources alter column subject_id drop not null;

-- Keep unclassified resources visible to filtered users and to the hybrid index.
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
    left join public.subjects s on s.id=r.subject_id
    left join public.branches b on b.id=r.branch_id
    left join public.semesters sem on sem.id=r.semester_id
    where r.is_published and r.deleted_at is null
      and (branch_filter is null or r.branch_id=branch_filter or r.branch_id is null)
      and (semester_filter is null or r.semester_id=semester_filter or r.semester_id is null)
      and (subject_filter is null or r.subject_id=subject_filter or r.subject_id is null)
      and (category_filter is null or r.category=category_filter)
      and (
        (query_embedding is not null and dc.embedding is not null and dc.embedding <=> query_embedding < 0.75)
        or (nullif(trim(query_text),'') is not null and dc.search_tsv @@ websearch_to_tsquery('english',query_text))
      )
  )
  select c.cid,c.rid,c.fid,c.body,c.ci,c.rtitle,c.rcategory,c.rdescription,c.rcreated,c.pname,c.sname,c.bname,c.semname,
    (0.62*c.vector_score + 0.38*least(c.text_score,1.0))::double precision
  from candidates c
  order by (0.62*c.vector_score + 0.38*least(c.text_score,1.0)) desc,c.rcreated desc,c.cid
  limit least(greatest(result_limit,1),30);
end $$;
revoke all on function public.hybrid_resource_search(extensions.vector,text,integer,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.hybrid_resource_search(extensions.vector,text,integer,uuid,uuid,uuid,text) to service_role;
