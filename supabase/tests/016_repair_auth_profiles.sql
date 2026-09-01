begin;
select plan(3);

select is(
  (
    select count(*)
    from auth.users as users
    left join public.profiles as profiles on profiles.id = users.id
    where profiles.id is null
  ),
  0::bigint,
  'every Auth user has an application profile'
);

select is(
  (
    select count(*)
    from auth.users as users
    left join public.user_preferences as preferences
      on preferences.user_id = users.id
    where preferences.user_id is null
  ),
  0::bigint,
  'every Auth user has application preferences'
);

select ok(
  position(
    'on conflict (id) do nothing' in
    lower(pg_get_functiondef('public.handle_new_user()'::regprocedure))
  ) > 0,
  'new-user provisioning tolerates an existing profile'
);

select * from finish();
rollback;
