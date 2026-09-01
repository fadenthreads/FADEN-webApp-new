begin;
select plan(10);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.boutique_profiles'::regclass),
  'boutique_profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.designs'::regclass),
  'designs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_boutiques'::regclass),
  'saved_boutiques has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.saved_designs'::regclass),
  'saved_designs has RLS enabled'
);
select has_function(
  'public',
  'is_boutique_member',
  array['uuid'],
  'membership authorization helper exists'
);
select has_index('public', 'designs', 'designs_published_idx', 'published design index exists');
select has_index('public', 'designs', 'designs_occasions_gin_idx', 'occasion filter index exists');
select has_index('public', 'designs', 'designs_materials_gin_idx', 'material filter index exists');
select ok(
  (select count(*) >= 4 from pg_policies where tablename = 'designs'),
  'design policies cover public reads and member writes'
);
select ok(
  (select count(*) = 1 from pg_policies where tablename = 'saved_designs'),
  'saved designs have an owner-only policy'
);

select * from finish();
rollback;
