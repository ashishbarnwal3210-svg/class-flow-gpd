create or replace function public.audit_resource_file_change() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; actor uuid; next_version integer;
begin
  rid:=coalesce(new.resource_id,old.resource_id);
  actor:=coalesce(auth.uid(),new.uploaded_by,old.uploaded_by);
  if TG_OP='INSERT' then
    select coalesce(max(version_number),0)+1 into next_version from public.resource_versions where resource_id=rid;
    insert into public.resource_versions(resource_id,version_number,metadata,file_manifest,editor_id,change_reason)
      values(rid,next_version,jsonb_build_object('action','file_add'),jsonb_build_array(to_jsonb(new)),actor,'File added');
    insert into public.resource_edit_history(resource_id,editor_id,action,after_state,change_reason)
      values(rid,actor,'file_add',to_jsonb(new),'File added');
    return new;
  elsif TG_OP='UPDATE' and old.deleted_at is distinct from new.deleted_at then
    select coalesce(max(version_number),0)+1 into next_version from public.resource_versions where resource_id=rid;
    insert into public.resource_versions(resource_id,version_number,metadata,file_manifest,editor_id,change_reason)
      values(rid,next_version,jsonb_build_object('action',case when new.deleted_at is null then 'file_restore' else 'file_remove' end),jsonb_build_array(to_jsonb(old)),actor,'File history change');
    insert into public.resource_edit_history(resource_id,editor_id,action,before_state,after_state,change_reason)
      values(rid,actor,case when new.deleted_at is null then 'file_restore' else 'file_remove' end,to_jsonb(old),to_jsonb(new),'File history change');
  end if;
  return new;
end $$;
drop trigger if exists resource_files_audit_update on public.resource_files;
create trigger resource_files_audit_insert_update after insert or update on public.resource_files for each row execute function public.audit_resource_file_change();
