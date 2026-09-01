begin;
select plan(11);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_addresses'::regclass),
  'user_addresses has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_preferences'::regclass),
  'user_preferences has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.boutique_invitations'::regclass),
  'boutique_invitations has RLS enabled'
);
select has_function(
  'public',
  'create_boutique_application',
  array['text', 'text', 'text', 'text'],
  'safe boutique onboarding function exists'
);
select has_function(
  'public',
  'admin_set_user_role',
  array['uuid', 'app_role', 'text'],
  'audited admin role function exists'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
  'authenticated users can update their display name'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated users cannot directly update roles'
);
select ok(
  has_table_privilege('authenticated', 'public.audit_events', 'SELECT'),
  'authenticated select on audit events is granted for RLS enforcement'
);
select ok(
  (select count(*) >= 1 from pg_policies where tablename = 'audit_events' and cmd = 'SELECT'),
  'audit events AAL2 select policy is installed'
);
select ok(
  not has_table_privilege('authenticated', 'public.outbox_events', 'SELECT'),
  'outbox remains unavailable to browser clients'
);
select ok(
  (select count(*) >= 1 from pg_policies where tablename = 'user_addresses'),
  'address policies are installed'
);

select * from finish();
rollback;
