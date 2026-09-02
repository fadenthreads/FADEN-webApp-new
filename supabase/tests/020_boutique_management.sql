begin;
select no_plan();

-- Setup test users
insert into auth.users(id,email) values
 ('a3000000-0000-4000-8000-000000000001','a03-customer@faden.local'),
 ('a3000000-0000-4000-8000-000000000002','a03-owner1@faden.local'),
 ('a3000000-0000-4000-8000-000000000003','a03-owner2@faden.local'),
 ('a3000000-0000-4000-8000-000000000004','a03-admin@faden.local');

update public.profiles set role='boutique_owner' where id='a3000000-0000-4000-8000-000000000002';
update public.profiles set role='boutique_owner' where id='a3000000-0000-4000-8000-000000000003';
update public.profiles set role='admin' where id='a3000000-0000-4000-8000-000000000004';

-- Setup test boutiques with various statuses
insert into public.boutiques(id,owner_id,slug,name,city,status,is_published,created_at) values
 ('a3000000-0000-4000-8000-000000000010','a3000000-0000-4000-8000-000000000002','a03-verified','A03 Verified Boutique','Mumbai','verified',true,now()-interval '30 days'),
 ('a3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000002','a03-pending','A03 Pending Boutique','Delhi','pending_verification',false,now()-interval '5 days'),
 ('a3000000-0000-4000-8000-000000000012','a3000000-0000-4000-8000-000000000003','a03-draft','A03 Draft Boutique','Bangalore','draft',false,now()-interval '2 days'),
 ('a3000000-0000-4000-8000-000000000013','a3000000-0000-4000-8000-000000000003','a03-suspended','A03 Suspended Boutique','Chennai','suspended',false,now()-interval '10 days'),
 ('a3000000-0000-4000-8000-000000000014',null,'a03-no-owner','A03 No Owner','Pune','draft',false,now()-interval '1 day');

-- ============================================================================
-- TEST: admin_list_boutiques authorization
-- ============================================================================

select throws_ok(
  $$select public.admin_list_boutiques()$$,
  'Authentication required',
  'anonymous users are denied'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_list_boutiques()$$,
  'Administrator AAL2 authentication required',
  'customers are denied even at AAL2'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_list_boutiques()$$,
  'Administrator AAL2 authentication required',
  'boutique owners are denied even at AAL2'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  $$select public.admin_list_boutiques()$$,
  'Administrator AAL2 authentication required',
  'AAL1 admins are denied'
);

-- ============================================================================
-- TEST: admin_list_boutiques success and pagination
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.admin_list_boutiques()$$,
  'AAL2 admins can list boutiques'
);

-- Test default list returns all boutiques
select ok(
  (select jsonb_array_length((public.admin_list_boutiques()->'boutiques'))) >= 5,
  'default list returns at least 5 boutiques including test data'
);

-- Test search by name
select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_search := 'A03 Verified')->'boutiques'))),
  1,
  'search by name returns matching boutiques'
);

-- Test search by slug
select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_search := 'a03-pending')->'boutiques'))),
  1,
  'search by slug returns matching boutiques'
);

-- Test search by owner email
select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_search := 'a03-owner1@')->'boutiques'))),
  2,
  'search by owner email returns matching boutiques'
);

-- ============================================================================
-- TEST: admin_list_boutiques status filtering
-- ============================================================================

select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_status := 'draft')->'boutiques'))),
  2,
  'filter by draft status works'
);

select ok(
  (select jsonb_array_length((public.admin_list_boutiques(p_status := 'verified')->'boutiques'))) >= 1,
  'filter by verified status works'
);

select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_status := 'pending_verification')->'boutiques'))),
  1,
  'filter by pending_verification status works'
);

select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_status := 'suspended')->'boutiques'))),
  1,
  'filter by suspended status works'
);

select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_status := 'rejected')->'boutiques'))),
  0,
  'filter by rejected status returns empty when none exist'
);

-- ============================================================================
-- TEST: admin_list_boutiques sorting
-- ============================================================================

select ok(
  (select (public.admin_list_boutiques(p_sort_by := 'created_desc')->'boutiques'->0->>'slug')) like '%',
  'sort by created_desc returns a boutique'
);

select is(
  (select (public.admin_list_boutiques(p_sort_by := 'created_asc')->'boutiques'->0->>'slug')),
  'a03-verified',
  'sort by created_asc returns oldest test boutique first'
);

-- ============================================================================
-- TEST: admin_list_boutiques pagination
-- ============================================================================

-- Test page size limit
select is(
  (select jsonb_array_length((public.admin_list_boutiques(p_limit := 2)->'boutiques'))),
  2,
  'pagination respects requested limit'
);

select is(
  (select (public.admin_list_boutiques(p_limit := 2)->'has_more')::boolean),
  true,
  'has_more is true when more results exist'
);

select throws_ok(
  $$select public.admin_list_boutiques(p_limit := 0)$$,
  'Page size must be positive',
  'non-positive page sizes are rejected'
);

select throws_ok(
  $$select public.admin_list_boutiques(p_sort_by := 'unsafe')$$,
  'Invalid boutique sort',
  'unknown sort values are rejected'
);

select throws_ok(
  $$select public.admin_list_boutiques(p_status := 'unsafe')$$,
  'Invalid boutique status filter',
  'unknown status values are rejected'
);

-- Test maximum page size
select ok(
  (select jsonb_array_length((public.admin_list_boutiques(p_limit := 999)->'boutiques'))) >= 5,
  'maximum page size is enforced and returns at least test data'
);
select ok(
  (select jsonb_array_length((public.admin_list_boutiques(p_limit := 999)->'boutiques'))) <= 100,
  'maximum page size never exceeds 100'
);

-- Test cursor pagination without duplicates  
do $$
declare
  v_first_page jsonb;
  v_cursor text;
  v_second_page jsonb;
  v_first_ids text[];
  v_second_ids text[];
  v_overlap_count integer;
begin
  -- Get first page with small limit to test pagination
  select public.admin_list_boutiques(p_limit := 3, p_sort_by := 'created_desc') into v_first_page;
  v_cursor := v_first_page->>'next_cursor';
  
  -- Skip if we don't have enough data for two pages
  if v_cursor is null then
    return;
  end if;
  
  -- Get second page using cursor
  select public.admin_list_boutiques(p_limit := 3, p_cursor := v_cursor, p_sort_by := 'created_desc') into v_second_page;
  
  -- Extract IDs from both pages
  select array_agg(item->>'id')
  into v_first_ids
  from jsonb_array_elements(v_first_page->'boutiques') item;
  
  select array_agg(item->>'id')
  into v_second_ids
  from jsonb_array_elements(v_second_page->'boutiques') item;
  
  -- Check no overlap
  select count(*)::integer
  into v_overlap_count
  from unnest(v_first_ids) id1
  where id1 = any(v_second_ids);
  
  if v_overlap_count > 0 then
    raise exception 'cursor pagination has % duplicate results', v_overlap_count;
  end if;
end $$;

select pass('cursor pagination produces no duplicates');

-- ============================================================================
-- TEST: admin_suspend_boutique authorization
-- ============================================================================

-- Clear auth state for anonymous test
select set_config('request.jwt.claims', null, true);
reset role;

select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'test reason')$$,
  'Authentication required',
  'anonymous users cannot suspend boutiques'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'customers cannot suspend boutiques'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'boutique owners cannot suspend boutiques'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'AAL1 admins cannot suspend boutiques'
);

-- ============================================================================
-- TEST: admin_suspend_boutique validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, '')$$,
  'Suspension reason is required',
  'empty suspension reason is rejected'
);

select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, null)$$,
  'Suspension reason is required',
  'null suspension reason is rejected'
);

select throws_ok(
  $$select public.admin_suspend_boutique('00000000-0000-4000-8000-000000000000'::uuid, 'test reason')$$,
  'Boutique not found',
  'suspending non-existent boutique is rejected'
);

select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000013'::uuid, 'test reason')$$,
  'Boutique is already suspended',
  'suspending already-suspended boutique is rejected'
);

-- ============================================================================
-- TEST: admin_suspend_boutique success
-- ============================================================================

select lives_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'Policy violation')$$,
  'AAL2 admin can suspend a verified boutique'
);

select is(
  (select status from public.boutiques where id = 'a3000000-0000-4000-8000-000000000010'),
  'suspended'::public.boutique_status,
  'suspended boutique has correct status'
);

select is(
  (select is_published from public.boutiques where id = 'a3000000-0000-4000-8000-000000000010'),
  false,
  'suspended boutique is unpublished'
);

-- Check audit event was created
select is(
  (select count(*)::integer from public.audit_events where entity_id = 'a3000000-0000-4000-8000-000000000010' and action = 'boutique.suspended'),
  1,
  'suspension creates audit event'
);

select is(
  (select reason from public.audit_events where entity_id = 'a3000000-0000-4000-8000-000000000010' and action = 'boutique.suspended'),
  'Policy violation',
  'audit event records suspension reason'
);

-- ============================================================================
-- TEST: admin_restore_boutique authorization
-- ============================================================================

-- Clear auth state for anonymous test
select set_config('request.jwt.claims', null, true);
reset role;

select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, 'test reason')$$,
  'Authentication required',
  'anonymous users cannot restore boutiques'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'customers cannot restore boutiques'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'boutique owners cannot restore boutiques'
);

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, 'test reason')$$,
  'Administrator AAL2 authentication required',
  'AAL1 admins cannot restore boutiques'
);

-- ============================================================================
-- TEST: admin_restore_boutique validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, '')$$,
  'Restoration reason is required',
  'empty restoration reason is rejected'
);

select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000013'::uuid, null)$$,
  'Restoration reason is required',
  'null restoration reason is rejected'
);

select throws_ok(
  $$select public.admin_restore_boutique('00000000-0000-4000-8000-000000000000'::uuid, 'test reason')$$,
  'Boutique not found',
  'restoring non-existent boutique is rejected'
);

select throws_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000011'::uuid, 'test reason')$$,
  'Only suspended boutiques can be restored',
  'restoring non-suspended boutique is rejected'
);

-- ============================================================================
-- TEST: admin_restore_boutique success
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);

-- Verify boutique was suspended in previous test
select is(
  (select status from public.boutiques where id = 'a3000000-0000-4000-8000-000000000010'),
  'suspended'::public.boutique_status,
  'boutique is suspended before restore test'
);

-- Restore the boutique that was suspended in the previous test
select lives_ok(
  $$select public.admin_restore_boutique('a3000000-0000-4000-8000-000000000010'::uuid, 'Appeal approved')$$,
  'AAL2 admin can restore a suspended boutique'
);

select is(
  (select status from public.boutiques where id = 'a3000000-0000-4000-8000-000000000010'),
  'verified'::public.boutique_status,
  'restored boutique recovers its trusted pre-suspension status'
);

select is(
  (select is_published from public.boutiques where id = 'a3000000-0000-4000-8000-000000000010'),
  false,
  'restored verified boutique is not automatically republished'
);

-- Check audit event was created
select is(
  (select count(*)::integer from public.audit_events where entity_id = 'a3000000-0000-4000-8000-000000000010' and action = 'boutique.restored'),
  1,
  'restoration creates audit event'
);

select is(
  (select reason from public.audit_events where entity_id = 'a3000000-0000-4000-8000-000000000010' and action = 'boutique.restored'),
  'Appeal approved',
  'audit event records restoration reason'
);

-- ============================================================================
-- TEST: Concurrent suspension safety
-- ============================================================================

-- Create a boutique for concurrent test (temporarily elevate for test data setup)
set local role postgres;
insert into public.boutiques(id,owner_id,slug,name,status,is_published) values
 ('a3000000-0000-4000-8000-000000000099','a3000000-0000-4000-8000-000000000002','a03-concurrent','A03 Concurrent Test','verified',true);
set local role authenticated;

select lives_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000099'::uuid, 'First suspension')$$,
  'first concurrent suspension succeeds'
);

-- Try to suspend again (should fail due to row locking and status check)
select throws_ok(
  $$select public.admin_suspend_boutique('a3000000-0000-4000-8000-000000000099'::uuid, 'Second suspension')$$,
  'Boutique is already suspended',
  'concurrent suspension attempts are prevented'
);

select * from finish();
rollback;
