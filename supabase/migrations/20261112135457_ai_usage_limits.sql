create table if not exists public.ai_usage_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 operation text not null check(operation in ('copilot_search','general_answer','document_index')),
 units integer not null default 1 check(units>0), created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day_idx on public.ai_usage_events(user_id,created_at desc);
alter table public.ai_usage_events enable row level security;
create policy "members read own AI usage" on public.ai_usage_events for select to authenticated using(user_id=auth.uid() or public.is_admin());

create or replace function public.consume_ai_request(p_user uuid,p_operation text,p_daily_limit integer default 40,p_units integer default 1) returns boolean
language plpgsql security definer set search_path=public as $$
declare used_count integer;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_operation not in ('copilot_search','general_answer','document_index') then raise exception 'invalid AI operation'; end if;
 perform pg_advisory_xact_lock(hashtext(p_user::text));
 select coalesce(sum(units),0)::integer into used_count from public.ai_usage_events where user_id=p_user and created_at>=date_trunc('day',now());
 if used_count+p_units>greatest(1,least(p_daily_limit,500)) then return false; end if;
 insert into public.ai_usage_events(user_id,operation,units) values(p_user,p_operation,greatest(1,p_units));
 return true;
end $$;
revoke all on function public.consume_ai_request(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_ai_request(uuid,text,integer,integer) to service_role;
