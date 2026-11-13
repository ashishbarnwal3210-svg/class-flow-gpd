-- Service-only identifier resolution. Email addresses are never exposed to unauthenticated clients.
create table if not exists public.student_login_rate_limits (
  rate_key text primary key check (rate_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table public.student_login_rate_limits enable row level security;
revoke all on public.student_login_rate_limits from public, anon, authenticated;

create or replace function public.resolve_student_login_email(p_identifier text) returns text
language plpgsql stable security definer set search_path=public as $$
declare resolved_email text; identifier_value text:=lower(trim(p_identifier));
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if identifier_value is null or length(identifier_value)<2 or length(identifier_value)>120 then return null; end if;
 select pp.email into resolved_email
 from public.profile_private pp
 left join public.profiles p on p.id=pp.id
 where lower(pp.email)=identifier_value
    or lower(pp.student_id)=identifier_value
    or lower(pp.board_roll_number)=identifier_value
    or lower(coalesce(p.classflow_id,''))=identifier_value
 order by case when lower(pp.student_id)=identifier_value then 1
               when lower(pp.board_roll_number)=identifier_value then 2 else 3 end
 limit 1;
 return resolved_email;
end $$;
revoke all on function public.resolve_student_login_email(text) from public,anon,authenticated;
grant execute on function public.resolve_student_login_email(text) to service_role;

create or replace function public.check_student_login_rate_limit(p_rate_key text,p_max_attempts integer default 6,p_window_seconds integer default 900) returns boolean
language plpgsql security definer set search_path=public as $$
declare started_at timestamptz; attempt_count integer; window_size integer; attempt_limit integer;
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid rate key'; end if;
 window_size:=greatest(60,least(coalesce(p_window_seconds,900),3600));
 attempt_limit:=greatest(3,least(coalesce(p_max_attempts,6),10));
 perform pg_advisory_xact_lock(hashtext(p_rate_key));
 delete from public.student_login_rate_limits where window_started_at<now()-interval '24 hours';
 select window_started_at,attempts into started_at,attempt_count
 from public.student_login_rate_limits where rate_key=p_rate_key for update;
 if not found then
   insert into public.student_login_rate_limits(rate_key,window_started_at,attempts) values(p_rate_key,now(),1);
   return true;
 end if;
 if started_at<now()-make_interval(secs=>window_size) then
   update public.student_login_rate_limits set window_started_at=now(),attempts=1 where rate_key=p_rate_key;
   return true;
 end if;
 if attempt_count>=attempt_limit then return false; end if;
 update public.student_login_rate_limits set attempts=attempt_count+1 where rate_key=p_rate_key;
 return true;
end $$;
revoke all on function public.check_student_login_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.check_student_login_rate_limit(text,integer,integer) to service_role;
