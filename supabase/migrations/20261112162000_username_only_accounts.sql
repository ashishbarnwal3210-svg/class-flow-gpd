-- Username-only ClassFlow registration. Supabase Auth still requires an email field,
-- so the app assigns a reserved, non-deliverable alias that is never shown to users.
alter table public.profiles
  add column if not exists username text not null
  check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$');
create unique index if not exists profiles_username_unique on public.profiles(username);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public,auth,extensions as $$
declare
  m jsonb;
  normalized_name text;
  normalized_username text;
  generated_id text;
begin
  m := new.raw_user_meta_data;
  normalized_name := trim(coalesce(m->>'full_name',''));
  normalized_username := lower(trim(coalesce(m->>'username','')));
  if length(normalized_name)<2 or length(normalized_name)>80 then
    raise exception 'Name must be 2 to 80 characters';
  end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3 to 24 letters, numbers, or underscores';
  end if;

  generated_id := 'CF-' || nextval('public.classflow_id_seq')::text;
  insert into public.profiles(id,classflow_id,full_name,username)
    values(new.id,generated_id,normalized_name,normalized_username);
  -- Keep legacy private fields populated with opaque placeholders for existing schema consumers.
  insert into public.profile_private(id,student_id,board_roll_number,mobile_number,email)
    values(new.id,'AUTO-'||new.id::text,'AUTO-ROLL-'||new.id::text,null,new.email);
  insert into public.user_roles(user_id,role) values(new.id,'student');
  return new;
end $$;

create or replace function public.resolve_student_login_email(p_identifier text) returns text
language plpgsql stable security definer set search_path=public as $$
declare resolved_email text; identifier_value text:=lower(trim(p_identifier));
begin
 if auth.role()<>'service_role' then raise exception 'service role required'; end if;
 if identifier_value is null or length(identifier_value)<2 or length(identifier_value)>120 then return null; end if;
 select pp.email into resolved_email
 from public.profile_private pp
 left join public.profiles p on p.id=pp.id
 where lower(p.username)=identifier_value
    or lower(pp.email)=identifier_value
    or lower(pp.student_id)=identifier_value
    or lower(pp.board_roll_number)=identifier_value
    or lower(coalesce(p.classflow_id,''))=identifier_value
    or lower(p.id::text)=identifier_value
 order by case when lower(p.username)=identifier_value then 1
               when lower(pp.email)=identifier_value then 2
               when lower(pp.student_id)=identifier_value then 3
               when lower(pp.board_roll_number)=identifier_value then 4 else 5 end
 limit 1;
 return resolved_email;
end $$;
revoke all on function public.resolve_student_login_email(text) from public,anon,authenticated;
grant execute on function public.resolve_student_login_email(text) to service_role;
