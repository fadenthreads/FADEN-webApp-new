begin;
select plan(5);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.boutiques'::regclass),
  'boutiques has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.boutique_members'::regclass),
  'boutique_members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit_events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.outbox_events'::regclass),
  'outbox_events has RLS enabled'
);

select * from finish();
rollback;

