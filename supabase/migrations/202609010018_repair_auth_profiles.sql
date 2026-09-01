-- Auth users may predate the application profile trigger. Repair those users
-- without changing any profile or preference records that already exist.
insert into public.profiles (id, display_name, phone, avatar_url)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name'
  ),
  users.phone,
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select profiles.id
from public.profiles as profiles
on conflict (user_id) do nothing;

-- Keep provisioning idempotent so identity linking or a partially repaired
-- account cannot fail because one of the two application records exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.phone,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

notify pgrst, 'reload schema';
