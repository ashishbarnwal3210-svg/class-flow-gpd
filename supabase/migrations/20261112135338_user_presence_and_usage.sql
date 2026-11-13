-- Optional activity and resource engagement tables used for real dashboard statistics and moderation.
create table if not exists public.resource_downloads (
 id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, downloaded_at timestamptz not null default now()
);
create index if not exists resource_downloads_rank_idx on public.resource_downloads(resource_id,downloaded_at desc);
alter table public.resource_downloads enable row level security;
create policy "read own resource downloads" on public.resource_downloads for select to authenticated using(user_id=auth.uid() or public.has_permission('resources.manage'));
create policy "record own resource downloads" on public.resource_downloads for insert to authenticated with check(user_id=auth.uid());

create table if not exists public.user_presence (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 is_online boolean not null default false, last_seen_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
create policy "read visible presence" on public.user_presence for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=user_id and coalesce((p.privacy->>'online_visible')::boolean,true)));
create policy "update own presence" on public.user_presence for insert to authenticated with check(user_id=auth.uid());
create policy "update own presence state" on public.user_presence for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.user_presence;
