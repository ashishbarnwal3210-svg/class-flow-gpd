-- ClassFlow foundational schema. Apply with `supabase db push`.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create sequence if not exists public.classflow_id_seq start 1001;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  classflow_id text not null unique,
  full_name text not null,
  avatar_url text,
  bio text,
  branch_id uuid,
  semester_id uuid,
  privacy jsonb not null default '{"directory_visible": true, "online_visible": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student','subadmin','admin')),
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- Personally identifying campus information is separated from the directory profile.
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  student_id text not null unique,
  board_roll_number text not null unique,
  mobile_number text,
  email text,
  updated_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('subadmin')),
  permission text not null,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(role,permission)
);
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(), name text not null unique, code text unique,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(), name text not null unique, number int not null unique check(number > 0),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_branch_id_fkey foreign key(branch_id) references public.branches(id) on delete set null;
alter table public.profiles add constraint profiles_semester_id_fkey foreign key(semester_id) references public.semesters(id) on delete set null;
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(), name text not null, code text,
  branch_id uuid not null references public.branches(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  description text, is_active boolean not null default true,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(name,branch_id,semester_id)
);
create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  is_active boolean not null default true, requires_assignment_type boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.resource_categories(name,requires_assignment_type) values
 ('Notes',false),('Assignment',true),('Practical',false),('Lab Manual',false),('PYQ',false),('Notice',false),('Syllabus',false),('Question Bank',false),('Other',false)
on conflict(name) do nothing;
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 160),
  description text, category text not null check(category in ('Notes','Assignment','Practical','Lab Manual','PYQ','Notice','Syllabus','Question Bank','Other')),
  assignment_type text check(assignment_type is null or assignment_type in ('Assignment 1','Assignment 2','Other Assignment')),
  branch_id uuid not null references public.branches(id), semester_id uuid not null references public.semesters(id),
  subject_id uuid not null references public.subjects(id), unit_module text, academic_year text,
  tags text[] not null default '{}', page_count integer check(page_count is null or page_count > 0),
  uploaded_by uuid not null references public.profiles(id), is_published boolean not null default true,
  deleted_at timestamptz, deleted_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint assignment_category_consistency check ((category='Assignment' and assignment_type is not null) or (category<>'Assignment' and assignment_type is null))
);
create index if not exists resources_public_created_idx on public.resources(is_published,created_at desc) where deleted_at is null;
create index if not exists resources_filter_idx on public.resources(branch_id,semester_id,subject_id,category) where deleted_at is null;
create index if not exists resources_uploader_idx on public.resources(uploaded_by,created_at desc);
create index if not exists resources_search_idx on public.resources using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create table if not exists public.resource_files (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  original_name text not null, storage_path text not null unique, mime_type text not null, size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800),
  uploaded_by uuid not null references public.profiles(id), page_count integer check(page_count is null or page_count>0),
  checksum_sha256 text, version_number int not null default 1, created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists resource_files_resource_idx on public.resource_files(resource_id) where deleted_at is null;
create table if not exists public.resource_versions (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  version_number integer not null, metadata jsonb not null, file_manifest jsonb not null default '[]', editor_id uuid not null references public.profiles(id),
  change_reason text, created_at timestamptz not null default now(), unique(resource_id,version_number)
);
create table if not exists public.resource_edit_history (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  editor_id uuid not null references public.profiles(id), action text not null, before_state jsonb, after_state jsonb,
  change_reason text, created_at timestamptz not null default now()
);
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  priority text not null default 'normal' check(priority in ('normal','important','urgent')),
  author_id uuid not null references public.profiles(id), branch_id uuid references public.branches(id), semester_id uuid references public.semesters(id),
  is_published boolean not null default false, publish_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(), title text not null, description text, subject_id uuid references public.subjects(id),
  branch_id uuid references public.branches(id), semester_id uuid references public.semesters(id), due_at timestamptz,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(), branch_id uuid references public.branches(id), semester_id uuid references public.semesters(id),
  subject_id uuid references public.subjects(id), weekday smallint not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null check(ends_at>starts_at),
  room text, instructor text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(sender_id<>recipient_id)
);
create unique index if not exists friend_requests_active_pair_idx on public.friend_requests(least(sender_id,recipient_id),greatest(sender_id,recipient_id)) where status in ('pending','accepted');
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(), user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  check(user_one<user_two), unique(user_one,user_two)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('direct','group')),
  title text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')), joined_at timestamptz not null default now(), last_read_at timestamptz,
  muted_until timestamptz, primary key(conversation_id,user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,joined_at desc);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), body text not null check(length(body)<=10000), reply_to uuid references public.messages(id),
  edited_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null unique, original_name text not null, mime_type text not null, size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800), created_at timestamptz not null default now()
);
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check(length(reaction)<=16), created_at timestamptz not null default now(), primary key(message_id,user_id,reaction)
);
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(), title text not null, description text, photo_path text,
  created_by uuid not null references public.profiles(id), conversation_id uuid unique references public.conversations(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')), added_by uuid references public.profiles(id), joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id), provider text not null default 'livekit',
  room_name text not null unique, call_type text not null check(call_type in ('audio','video')), started_by uuid not null references public.profiles(id),
  started_at timestamptz not null default now(), ended_at timestamptz
);
create table if not exists public.call_participants (
  call_id uuid not null references public.calls(id) on delete cascade, user_id uuid not null references public.profiles(id), joined_at timestamptz, left_at timestamptz, primary key(call_id,user_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, title text not null, body text, target_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade, resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,resource_id)
);
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade, blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id), target_type text not null check(target_type in ('user','resource','message','group')),
  target_id uuid not null, reason text not null, details text, status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  assigned_to uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  file_id uuid references public.resource_files(id) on delete cascade, chunk_index int not null, content text not null,
  embedding extensions.vector(1536), search_tsv tsvector generated always as (to_tsvector('english',content)) stored,
  created_at timestamptz not null default now(), unique(file_id,chunk_index)
);
create index if not exists document_chunks_fts_idx on public.document_chunks using gin(search_tsv);
create index if not exists document_chunks_vector_idx on public.document_chunks using hnsw(embedding extensions.vector_cosine_ops) where embedding is not null;
-- Only integration status and non-sensitive metadata belong in this table; secrets live in server-side Supabase secrets/Vault.
create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(), provider text not null unique,
  status text not null default 'not_configured' check(status in ('not_configured','configured','active','inactive','error')),
  safe_metadata jsonb not null default '{}', last_tested_at timestamptz, last_error text, updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null,
  target_type text, target_id uuid, before_state jsonb, after_state jsonb, ip_hash text, created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') $$;
create or replace function public.has_permission(permission_name text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin') or
 exists(select 1 from public.user_roles r join public.role_permissions p on p.role=r.role where r.user_id=auth.uid() and p.permission=permission_name)
$$;
create or replace function public.can_manage_resource(resource_owner uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid()=resource_owner or public.has_permission('resources.manage') or public.has_permission('resources.edit') or public.has_permission('resources.delete')
$$;
create or replace function public.is_conversation_member(cid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid()) $$;

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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Record resource edits for an audit trail. Previous file manifests are recorded by the application before replacing files.
create or replace function public.audit_resource_change() returns trigger language plpgsql security definer set search_path=public as $$
declare next_version integer;
begin
 if TG_OP='UPDATE' and (to_jsonb(old)-'updated_at') is distinct from (to_jsonb(new)-'updated_at') then
   select coalesce(max(version_number),0)+1 into next_version from public.resource_versions where resource_id=new.id;
   insert into public.resource_versions(resource_id,version_number,metadata,editor_id,change_reason)
   values(new.id,next_version,to_jsonb(old),auth.uid(),nullif(current_setting('app.resource_change_reason',true),''));
   insert into public.resource_edit_history(resource_id,editor_id,action,before_state,after_state,change_reason)
   values(new.id,auth.uid(),case when new.deleted_at is not null and old.deleted_at is null then 'soft_delete' else 'metadata_update' end,to_jsonb(old),to_jsonb(new),nullif(current_setting('app.resource_change_reason',true),''));
 end if;
 return new;
end $$;
drop trigger if exists resources_audit_update on public.resources;
create trigger resources_audit_update before update on public.resources for each row execute function public.audit_resource_change();

-- Basic read/write policies. Privileged changes are enforced in Postgres, not in UI visibility.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.profile_private enable row level security;
alter table public.role_permissions enable row level security;
alter table public.branches enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.resource_categories enable row level security;
alter table public.resources enable row level security;
alter table public.resource_files enable row level security;
alter table public.resource_versions enable row level security;
alter table public.resource_edit_history enable row level security;
alter table public.notices enable row level security;
alter table public.assignments enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.bookmarks enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.document_chunks enable row level security;
alter table public.integration_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated can see directory profiles" on public.profiles for select to authenticated using(deleted_at is null and (coalesce((privacy->>'directory_visible')::boolean,true) or id=auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "admin manage profiles" on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read own private profile or admin" on public.profile_private for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "update own private profile" on public.profile_private for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "admin manage private profiles" on public.profile_private for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read own or admin role" on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "admin manage roles" on public.user_roles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read permissions" on public.role_permissions for select to authenticated using(public.is_admin() or exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role=role_permissions.role));
create policy "admin manage permissions" on public.role_permissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read branches" on public.branches for select to authenticated using(is_active or public.is_admin());
create policy "admin manage branches" on public.branches for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read semesters" on public.semesters for select to authenticated using(is_active or public.is_admin());
create policy "admin manage semesters" on public.semesters for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read subjects" on public.subjects for select to authenticated using(is_active or public.has_permission('academic.manage'));
create policy "authorized manage subjects" on public.subjects for all to authenticated using(public.has_permission('academic.manage')) with check(public.has_permission('academic.manage'));
create policy "read categories" on public.resource_categories for select to authenticated using(is_active or public.has_permission('academic.manage'));
create policy "authorized manage categories" on public.resource_categories for all to authenticated using(public.has_permission('academic.manage')) with check(public.has_permission('academic.manage'));
create policy "read published resources" on public.resources for select to authenticated using((is_published and deleted_at is null) or public.can_manage_resource(uploaded_by));
create policy "create own resources" on public.resources for insert to authenticated with check(uploaded_by=auth.uid());
create policy "manage allowed resources" on public.resources for update to authenticated using(public.can_manage_resource(uploaded_by)) with check(public.can_manage_resource(uploaded_by));
create policy "soft delete allowed resources" on public.resources for delete to authenticated using(public.can_manage_resource(uploaded_by));
create policy "read files with resource" on public.resource_files for select to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and ((r.is_published and r.deleted_at is null) or public.can_manage_resource(r.uploaded_by))) and deleted_at is null);
create policy "add files to managed resource" on public.resource_files for insert to authenticated with check(uploaded_by=auth.uid() and exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));
create policy "manage files for managed resource" on public.resource_files for update to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by))) with check(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));
create policy "delete files for managed resource" on public.resource_files for delete to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));
create policy "read own resource history" on public.resource_versions for select to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));
create policy "read own edit history" on public.resource_edit_history for select to authenticated using(exists(select 1 from public.resources r where r.id=resource_id and public.can_manage_resource(r.uploaded_by)));
create policy "published notices readable" on public.notices for select to authenticated using((is_published and deleted_at is null) or public.has_permission('notices.manage'));
create policy "authorized manage notices" on public.notices for all to authenticated using(public.has_permission('notices.manage')) with check(public.has_permission('notices.manage'));
create policy "read assignments" on public.assignments for select to authenticated using(deleted_at is null);
create policy "manage assignments" on public.assignments for all to authenticated using(public.has_permission('academic.manage')) with check(public.has_permission('academic.manage'));
create policy "read timetable" on public.timetable_entries for select to authenticated using(true);
create policy "manage timetable" on public.timetable_entries for all to authenticated using(public.has_permission('academic.manage')) with check(public.has_permission('academic.manage'));
create policy "manage own requests" on public.friend_requests for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "send friend requests" on public.friend_requests for insert to authenticated with check(sender_id=auth.uid());
create policy "respond to friend requests" on public.friend_requests for update to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid()) with check(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "read own friendships" on public.friendships for select to authenticated using(user_one=auth.uid() or user_two=auth.uid());
create policy "friendship insert via accepted request" on public.friendships for insert to authenticated with check((user_one=auth.uid() or user_two=auth.uid()) and exists(select 1 from public.friend_requests f where f.status='accepted' and least(f.sender_id,f.recipient_id)=user_one and greatest(f.sender_id,f.recipient_id)=user_two));
create policy "members read conversations" on public.conversations for select to authenticated using(public.is_conversation_member(id));
create policy "members create conversations" on public.conversations for insert to authenticated with check(created_by=auth.uid());
create policy "admins or creator update conversations" on public.conversations for update to authenticated using(created_by=auth.uid() or public.has_permission('groups.manage')) with check(created_by=auth.uid() or public.has_permission('groups.manage'));
create policy "members see membership" on public.conversation_members for select to authenticated using(user_id=auth.uid() or public.is_conversation_member(conversation_id));
create policy "conversation creator add members" on public.conversation_members for insert to authenticated with check(user_id=auth.uid() or exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid()) or public.has_permission('groups.manage'));
create policy "self update conversation read state" on public.conversation_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "members read messages" on public.messages for select to authenticated using(public.is_conversation_member(conversation_id));
create policy "members send own messages" on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.is_conversation_member(conversation_id));
create policy "authors edit own messages" on public.messages for update to authenticated using(sender_id=auth.uid() or public.has_permission('messages.moderate')) with check(sender_id=auth.uid() or public.has_permission('messages.moderate'));
create policy "authors delete own messages" on public.messages for delete to authenticated using(sender_id=auth.uid() or public.has_permission('messages.moderate'));
create policy "members read message attachments" on public.message_attachments for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id)));
create policy "send message attachments" on public.message_attachments for insert to authenticated with check(exists(select 1 from public.messages m where m.id=message_id and m.sender_id=auth.uid() and public.is_conversation_member(m.conversation_id)));
create policy "read reactions in conversation" on public.message_reactions for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id)));
create policy "manage own reactions" on public.message_reactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id)));
create policy "group members read groups" on public.groups for select to authenticated using(exists(select 1 from public.group_members gm where gm.group_id=id and gm.user_id=auth.uid()));
create policy "create own groups" on public.groups for insert to authenticated with check(created_by=auth.uid());
create policy "group owners manage groups" on public.groups for update to authenticated using(created_by=auth.uid() or public.has_permission('groups.manage')) with check(created_by=auth.uid() or public.has_permission('groups.manage'));
create policy "members read group roster" on public.group_members for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.group_members mine where mine.group_id=group_id and mine.user_id=auth.uid()));
create policy "group owner add members" on public.group_members for insert to authenticated with check(exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()) or public.has_permission('groups.manage'));
create policy "group owner remove members" on public.group_members for delete to authenticated using(exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()) or user_id=auth.uid() or public.has_permission('groups.manage'));
create policy "members read calls" on public.calls for select to authenticated using(public.is_conversation_member(conversation_id));
create policy "members create calls" on public.calls for insert to authenticated with check(started_by=auth.uid() and public.is_conversation_member(conversation_id));
create policy "call participants self manage" on public.call_participants for all to authenticated using(user_id=auth.uid() or exists(select 1 from public.calls c where c.id=call_id and public.has_permission('calls.manage'))) with check(user_id=auth.uid() or public.has_permission('calls.manage'));
create policy "read own notifications" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "read bookmarks own" on public.bookmarks for select to authenticated using(user_id=auth.uid());
create policy "manage own bookmarks" on public.bookmarks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "manage own blocks" on public.user_blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create policy "submit reports" on public.reports for insert to authenticated with check(reporter_id=auth.uid());
create policy "review reports" on public.reports for select to authenticated using(reporter_id=auth.uid() or public.has_permission('reports.manage'));
create policy "authorized update reports" on public.reports for update to authenticated using(public.has_permission('reports.manage')) with check(public.has_permission('reports.manage'));
create policy "AI service only chunks" on public.document_chunks for select to authenticated using(false);
create policy "admins see integration status only" on public.integration_settings for select to authenticated using(public.is_admin());
create policy "admins update safe integration metadata" on public.integration_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admins read audit logs" on public.audit_logs for select to authenticated using(public.is_admin());
create policy "insert audit events" on public.audit_logs for insert to authenticated with check(actor_id=auth.uid() and public.is_admin());

-- Secure, private file bucket. The client can upload only into its own uid prefix; reads follow resource visibility.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('classflow-resources','classflow-resources',false,52428800,array[
'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','image/png','image/jpeg','image/webp','image/gif','application/zip','application/x-zip-compressed'
]) on conflict(id) do update set public=false,file_size_limit=52428800;
create policy "upload resource file to own folder" on storage.objects for insert to authenticated with check(bucket_id='classflow-resources' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "read visible resource objects" on storage.objects for select to authenticated using(bucket_id='classflow-resources' and exists(select 1 from public.resource_files f join public.resources r on r.id=f.resource_id where f.storage_path=name and f.deleted_at is null and ((r.is_published and r.deleted_at is null) or public.can_manage_resource(r.uploaded_by))));
create policy "delete managed resource objects" on storage.objects for delete to authenticated using(bucket_id='classflow-resources' and exists(select 1 from public.resource_files f join public.resources r on r.id=f.resource_id where f.storage_path=name and public.can_manage_resource(r.uploaded_by)));

-- Starter integration status rows only (no secret values).
insert into public.integration_settings(provider,status) values('supabase','not_configured'),('ai','not_configured'),('livekit','not_configured'),('email','not_configured') on conflict(provider) do nothing;
