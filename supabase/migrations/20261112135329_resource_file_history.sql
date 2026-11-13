-- Keep file history recoverable: removal is a soft-delete and a version record, never an immediate object purge.
create or replace function public.audit_resource_file_change() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; actor uuid; next_version integer;
begin
  rid:=coalesce(new.resource_id,old.resource_id);
  actor:=coalesce(auth.uid(),new.uploaded_by,old.uploaded_by);
  if TG_OP='UPDATE' and old.deleted_at is distinct from new.deleted_at then
    select coalesce(max(version_number),0)+1 into next_version from public.resource_versions where resource_id=rid;
    insert into public.resource_versions(resource_id,version_number,metadata,file_manifest,editor_id,change_reason)
      values(rid,next_version,jsonb_build_object('action',case when new.deleted_at is null then 'file_restore' else 'file_remove' end),jsonb_build_array(to_jsonb(old)),actor,'File history change');
    insert into public.resource_edit_history(resource_id,editor_id,action,before_state,after_state,change_reason)
      values(rid,actor,case when new.deleted_at is null then 'file_restore' else 'file_remove' end,to_jsonb(old),to_jsonb(new),'File history change');
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists resource_files_audit_update on public.resource_files;
create trigger resource_files_audit_update after update on public.resource_files for each row execute function public.audit_resource_file_change();

-- Metadata snapshots also retain the exact old file manifest and can be reviewed or restored by authorized users.
create or replace function public.audit_resource_change() returns trigger language plpgsql security definer set search_path=public as $$
declare next_version integer; manifest jsonb; actor uuid;
begin
 if TG_OP='UPDATE' and (to_jsonb(old)-'updated_at') is distinct from (to_jsonb(new)-'updated_at') then
   actor:=coalesce(auth.uid(),new.uploaded_by);
   select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) into manifest from public.resource_files f where f.resource_id=old.id;
   select coalesce(max(version_number),0)+1 into next_version from public.resource_versions where resource_id=new.id;
   insert into public.resource_versions(resource_id,version_number,metadata,file_manifest,editor_id,change_reason)
     values(new.id,next_version,to_jsonb(old),manifest,actor,nullif(current_setting('app.resource_change_reason',true),''));
   insert into public.resource_edit_history(resource_id,editor_id,action,before_state,after_state,change_reason)
     values(new.id,actor,case when new.deleted_at is not null and old.deleted_at is null then 'soft_delete' else 'metadata_update' end,to_jsonb(old),to_jsonb(new),nullif(current_setting('app.resource_change_reason',true),''));
 end if;
 return new;
end $$;
