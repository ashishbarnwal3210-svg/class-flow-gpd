create or replace function public.resource_download_counts() returns table(resource_id uuid, downloads bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 return query select r.id,count(d.id)::bigint from public.resources r left join public.resource_downloads d on d.resource_id=r.id
 where r.is_published and r.deleted_at is null group by r.id;
end $$;
revoke all on function public.resource_download_counts() from public,anon;
grant execute on function public.resource_download_counts() to authenticated;
