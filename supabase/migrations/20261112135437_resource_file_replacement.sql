alter table public.resource_files add column if not exists replaces_file_id uuid references public.resource_files(id) on delete set null;
create index if not exists resource_files_replacement_idx on public.resource_files(replaces_file_id) where replaces_file_id is not null;
