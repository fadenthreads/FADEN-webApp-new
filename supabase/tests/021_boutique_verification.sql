begin;
select no_plan();

-- Setup test users
insert into auth.users(id,email) values
 ('a4000000-0000-4000-8000-000000000001','a04-customer@faden.local'),
 ('a4000000-0000-4000-8000-000000000002','a04-owner1@faden.local'),
 ('a4000000-0000-4000-8000-000000000003','a04-owner2@faden.local'),
 ('a4000000-0000-4000-8000-000000000004','a04-staff@faden.local'),
 ('a4000000-0000-4000-8000-000000000005','a04-admin-aal1@faden.local'),
 ('a4000000-0000-4000-8000-000000000006','a04-admin-aal2@faden.local');

update public.profiles set role='boutique_owner' where id in ('a4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000003');
update public.profiles set role='boutique_staff' where id='a4000000-0000-4000-8000-000000000004';
update public.profiles set role='admin' where id in ('a4000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000006');

-- Setup test boutiques
insert into public.boutiques(id,owner_id,slug,name,city,status,is_published) values
 ('a4000000-0000-4000-8000-000000000010','a4000000-0000-4000-8000-000000000002','a04-draft','A04 Draft Boutique','Mumbai','draft',false),
 ('a4000000-0000-4000-8000-000000000011','a4000000-0000-4000-8000-000000000003','a04-verified','A04 Verified Boutique','Delhi','verified',true),
 ('a4000000-0000-4000-8000-000000000012','a4000000-0000-4000-8000-000000000003','a04-suspended','A04 Suspended Boutique','Bangalore','suspended',false),
 ('a4000000-0000-4000-8000-000000000013','a4000000-0000-4000-8000-000000000002','a04-rejected','A04 Rejected Boutique','Chennai','rejected',false);

-- Add staff member to test boutique
insert into public.boutique_members(boutique_id,user_id,role) values
 ('a4000000-0000-4000-8000-000000000010','a4000000-0000-4000-8000-000000000004','boutique_staff');

-- ============================================================================
-- TEST: RLS - boutique_verification_submissions table access
-- ============================================================================

-- Anonymous users have no table privilege at all; verification data is private.
select is(
  has_table_privilege('anon', 'public.boutique_verification_submissions', 'select'),
  false,
  'anonymous users cannot read verification submissions'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(
  (select count(*)::integer from public.boutique_verification_submissions),
  0,
  'customers cannot read verification submissions'
);

-- ============================================================================
-- TEST: owner_create_verification_draft authorization
-- ============================================================================

select set_config('request.jwt.claims', null, true);
reset role;

select throws_ok(
  $$select public.owner_create_verification_draft('a4000000-0000-4000-8000-000000000010'::uuid, '{}'::jsonb)$$,
  'Authentication required',
  'anonymous users cannot create verification drafts'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.owner_create_verification_draft('a4000000-0000-4000-8000-000000000010'::uuid, '{}'::jsonb)$$,
  'Only the boutique owner can create verification drafts',
  'customers cannot create verification drafts'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.owner_create_verification_draft('a4000000-0000-4000-8000-000000000010'::uuid, '{}'::jsonb)$$,
  'Only the boutique owner can create verification drafts',
  'boutique staff cannot create verification drafts'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.owner_create_verification_draft('a4000000-0000-4000-8000-000000000010'::uuid, '{}'::jsonb)$$,
  'Only the boutique owner can create verification drafts',
  'unrelated boutique owner cannot create verification drafts'
);

-- ============================================================================
-- TEST: owner_create_verification_draft validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  $$select public.owner_create_verification_draft('00000000-0000-4000-8000-000000000000'::uuid, '{}'::jsonb)$$,
  'Boutique not found',
  'creating draft for non-existent boutique is rejected'
);

-- Test creating draft for verified boutique (requires being owner of that boutique)
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000011'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Test Business',
      'business_type', 'Private Limited',
      'registration_number', 'TEST123',
      'pan', 'AAAAA1111A',
      'registered_address_line1', '123 Test St',
      'city', 'Mumbai',
      'state', 'Maharashtra',
      'postal_code', '400001',
      'authorized_rep_name', 'Test',
      'authorized_rep_role', 'Director',
      'contact_email', 'test@test.in',
      'contact_phone', '+911234567890'
    )
  )$$,
  'Verification draft can only be created for draft or rejected boutiques',
  'creating draft for verified boutique is rejected'
);
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  $$select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000010'::uuid,
    '{"legal_business_name":"Test"}'::jsonb
  )$$,
  'Missing required verification fields',
  'creating draft with incomplete fields is rejected'
);

-- ============================================================================
-- TEST: owner_create_verification_draft success
-- ============================================================================

do $$
declare
  v_result jsonb;
  v_submission_id uuid;
begin
  select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000010'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Test Fashion Studio Private Limited',
      'public_trading_name', 'Test Fashion Studio',
      'business_type', 'Private Limited Company',
      'registration_number', 'U18101MH2020PTC123456',
      'gstin', '27AABCT1234F1Z5',
      'pan', 'AABCT1234F',
      'registered_address_line1', '123 Fashion Street',
      'registered_address_line2', 'Kala Ghoda',
      'city', 'Mumbai',
      'state', 'Maharashtra',
      'postal_code', '400001',
      'authorized_rep_name', 'Rajesh Kumar',
      'authorized_rep_role', 'Director',
      'contact_email', 'rajesh@testfashion.in',
      'contact_phone', '+919876543210'
    )
  ) into v_result;

  v_submission_id := (v_result->>'submission_id')::uuid;

  if (v_result->>'success')::boolean != true then
    raise exception 'draft creation failed';
  end if;

  if v_submission_id is null then
    raise exception 'submission_id is null';
  end if;

  -- Store submission ID for later tests
  perform set_config('tests.a04_submission_id', v_submission_id::text, false);
end $$;

select pass('boutique owner can create verification draft');

select is(
  (select status from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'draft'::text,
  'created submission has draft status'
);

select is(
  (select legal_business_name from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'Test Fashion Studio Private Limited',
  'submission stores legal business name'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'draft_created') = 1,
  'draft creation creates verification event'
);

-- ============================================================================
-- TEST: owner_create_verification_draft duplicate rejection
-- ============================================================================

select throws_ok(
  $$select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000010'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Test Business',
      'business_type', 'Private Limited',
      'registration_number', 'TEST123',
      'pan', 'AAAAA1111A',
      'registered_address_line1', '123 Test St',
      'city', 'Mumbai',
      'state', 'Maharashtra',
      'postal_code', '400001',
      'authorized_rep_name', 'Test',
      'authorized_rep_role', 'Director',
      'contact_email', 'test@test.in',
      'contact_phone', '+911234567890'
    )
  )$$,
  'A draft verification already exists for this boutique',
  'duplicate draft creation is rejected'
);

-- ============================================================================
-- TEST: owner_update_verification_draft authorization
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_update_verification_draft('%s'::uuid, '{}'::jsonb, 1)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only the boutique owner can update this verification draft',
  'customers cannot update verification drafts'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_update_verification_draft('%s'::uuid, '{}'::jsonb, 1)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only the boutique owner can update this verification draft',
  'boutique staff cannot update verification drafts'
);

-- ============================================================================
-- TEST: owner_update_verification_draft validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  format(
    $$select public.owner_update_verification_draft('%s'::uuid, jsonb_build_object('legal_business_name','Updated'), 999)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Optimistic concurrency conflict: submission was modified',
  'update with wrong version is rejected'
);

select throws_ok(
  format(
    $$select public.owner_update_verification_draft('%s'::uuid, jsonb_build_object('legal_business_name','Updated'), 1)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Missing required verification fields',
  'update with incomplete fields is rejected'
);

-- ============================================================================
-- TEST: owner_update_verification_draft success
-- ============================================================================

do $$
declare
  v_result jsonb;
begin
  select public.owner_update_verification_draft(
    current_setting('tests.a04_submission_id')::uuid,
    jsonb_build_object(
      'legal_business_name', 'Updated Fashion Studio Private Limited',
      'public_trading_name', 'Updated Fashion Studio',
      'business_type', 'Private Limited Company',
      'registration_number', 'U18101MH2020PTC999999',
      'gstin', '27AABCT9999F1Z5',
      'pan', 'AABCT9999F',
      'registered_address_line1', '456 New Fashion Street',
      'city', 'Mumbai',
      'state', 'Maharashtra',
      'postal_code', '400002',
      'authorized_rep_name', 'Priya Sharma',
      'authorized_rep_role', 'Managing Director',
      'contact_email', 'priya@updatedfashion.in',
      'contact_phone', '+919999999999'
    ),
    1
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'draft update failed';
  end if;

  if (v_result->>'version')::integer != 2 then
    raise exception 'version not incremented';
  end if;
end $$;

select pass('boutique owner can update verification draft');

select is(
  (select legal_business_name from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'Updated Fashion Studio Private Limited',
  'updated submission stores new business name'
);

select is(
  (select version from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  2,
  'update increments version'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'draft_updated') = 1,
  'draft update creates verification event'
);

-- ============================================================================
-- TEST: owner_attach_verification_document authorization
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_attach_verification_document('%s'::uuid, 'pan_document', 'test/key', 'test.pdf', 1000, 'application/pdf')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only the boutique owner can attach documents',
  'customers cannot attach verification documents'
);

-- ============================================================================
-- TEST: owner_attach_verification_document validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  format(
    $$select public.owner_attach_verification_document('%s'::uuid, 'invalid_category', 'test/key', 'test.pdf', 1000, 'application/pdf')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Invalid document category',
  'attaching document with invalid category is rejected'
);

select throws_ok(
  format(
    $$select public.owner_attach_verification_document('%s'::uuid, 'pan_document', 'wrong/key/format.pdf', 'test.pdf', 1000, 'application/pdf')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Invalid storage object key: must belong to your boutique',
  'attaching document with invalid storage key is rejected'
);

-- Test file size validation (use valid UUID format for storage key)
select throws_ok(
  format(
    $$select public.owner_attach_verification_document('%s'::uuid, 'pan_document', 'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000099.pdf', 'test.pdf', 16000000, 'application/pdf')$$,
    current_setting('tests.a04_submission_id')
  ),
  'File size must be between 1 byte and 15 MB',
  'attaching oversized document is rejected'
);

-- Test MIME type validation (Note: storage key format validation runs before MIME type check, so use .pdf extension)
-- We cannot test MIME type validation directly because storage key validation runs first and checks extension
-- The MIME type validation happens after storage key validation passes

-- ============================================================================
-- TEST: owner_attach_verification_document success
-- ============================================================================

do $$
declare
  v_result jsonb;
  v_document_id uuid;
begin
  -- Attach business registration (use valid UUID format)
  select public.owner_attach_verification_document(
    current_setting('tests.a04_submission_id')::uuid,
    'business_registration',
    'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000021.pdf',
    'registration-certificate.pdf',
    500000,
    'application/pdf'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'document attachment failed';
  end if;

  v_document_id := (v_result->>'document_id')::uuid;
  perform set_config('tests.a04_doc1_id', v_document_id::text, false);

  -- Attach PAN document (use valid UUID format)
  select public.owner_attach_verification_document(
    current_setting('tests.a04_submission_id')::uuid,
    'pan_document',
    'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000022.jpg',
    'pan-card.jpg',
    300000,
    'image/jpeg'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'second document attachment failed';
  end if;

  v_document_id := (v_result->>'document_id')::uuid;
  perform set_config('tests.a04_doc2_id', v_document_id::text, false);

  -- Attach address proof (use valid UUID format)
  select public.owner_attach_verification_document(
    current_setting('tests.a04_submission_id')::uuid,
    'address_proof',
    'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000023.pdf',
    'address-proof.pdf',
    400000,
    'application/pdf'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'third document attachment failed';
  end if;

  v_document_id := (v_result->>'document_id')::uuid;
  perform set_config('tests.a04_doc3_id', v_document_id::text, false);
end $$;

select pass('boutique owner can attach verification documents');

select is(
  (select count(*)::integer from public.boutique_verification_documents where submission_id = current_setting('tests.a04_submission_id')::uuid),
  3,
  'three documents attached to submission'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'document_attached') = 3,
  'document attachments create verification events'
);

-- ============================================================================
-- TEST: owner_attach_verification_document duplicate rejection
-- ============================================================================

select throws_ok(
  format(
    $$select public.owner_attach_verification_document('%s'::uuid, 'pan_document', 'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000022.jpg', 'dup.jpg', 1000, 'image/jpeg')$$,
    current_setting('tests.a04_submission_id')
  ),
  'This document has already been attached',
  'duplicate storage key attachment is rejected'
);

-- ============================================================================
-- TEST: owner_remove_verification_document authorization
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_remove_verification_document('%s'::uuid)$$,
    current_setting('tests.a04_doc1_id')
  ),
  'Only the document uploader can remove it',
  'customers cannot remove verification documents'
);

-- ============================================================================
-- TEST: owner_remove_verification_document success
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

-- Re-attach a test document for removal (use valid UUID format)
do $$
declare
  v_result jsonb;
  v_document_id uuid;
begin
  select public.owner_attach_verification_document(
    current_setting('tests.a04_submission_id')::uuid,
    'other_supporting_document',
    'a4000000-0000-4000-8000-000000000010/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000024.pdf',
    'temporary.pdf',
    100000,
    'application/pdf'
  ) into v_result;

  v_document_id := (v_result->>'document_id')::uuid;
  perform set_config('tests.a04_temp_doc_id', v_document_id::text, false);
end $$;

select lives_ok(
  format(
    $$select public.owner_remove_verification_document('%s'::uuid)$$,
    current_setting('tests.a04_temp_doc_id')
  ),
  'boutique owner can remove unsubmitted document'
);

select is(
  (select count(*)::integer from public.boutique_verification_documents where id = current_setting('tests.a04_temp_doc_id')::uuid),
  0,
  'removed document is deleted from database'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'document_removed') = 1,
  'document removal creates verification event'
);

-- ============================================================================
-- TEST: owner_submit_verification authorization
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_submit_verification('%s'::uuid, 2)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only the boutique owner can submit verification',
  'customers cannot submit verification'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.owner_submit_verification('%s'::uuid, 2)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only the boutique owner can submit verification',
  'boutique staff cannot submit verification'
);

-- ============================================================================
-- TEST: owner_submit_verification validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  format(
    $$select public.owner_submit_verification('%s'::uuid, 999)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Optimistic concurrency conflict: submission was modified',
  'submission with wrong version is rejected'
);

-- Create a submission with missing required documents to test validation
do $$
declare
  v_result jsonb;
  v_incomplete_submission_id uuid;
begin
  select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000013'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Incomplete Business',
      'business_type', 'Private Limited',
      'registration_number', 'TEST123',
      'pan', 'AAAAA1111A',
      'registered_address_line1', '123 Test St',
      'city', 'Mumbai',
      'state', 'Maharashtra',
      'postal_code', '400001',
      'authorized_rep_name', 'Test',
      'authorized_rep_role', 'Director',
      'contact_email', 'test@test.in',
      'contact_phone', '+911234567890'
    )
  ) into v_result;

  v_incomplete_submission_id := (v_result->>'submission_id')::uuid;
  perform set_config('tests.a04_incomplete_submission_id', v_incomplete_submission_id::text, false);
end $$;

-- Test that submission without required documents is rejected
do $$
begin
  perform public.owner_submit_verification(
    current_setting('tests.a04_incomplete_submission_id')::uuid,
    1
  );
  raise exception 'Expected exception was not raised';
exception when others then
  if sqlerrm not like '%Missing required documents%' then
    raise exception 'Unexpected error: %', sqlerrm;
  end if;
end $$;

select pass('submission without required documents is rejected');

-- ============================================================================
-- TEST: owner_submit_verification success
-- ============================================================================

do $$
declare
  v_result jsonb;
begin
  select public.owner_submit_verification(
    current_setting('tests.a04_submission_id')::uuid,
    2
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'verification submission failed';
  end if;

  if (v_result->>'version')::integer != 3 then
    raise exception 'version not incremented on submission';
  end if;
end $$;

select pass('boutique owner can submit verification');

select is(
  (select status from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'submitted'::text,
  'submitted verification has submitted status'
);

select is(
  (select status from public.boutiques where id = 'a4000000-0000-4000-8000-000000000010'),
  'pending_verification'::public.boutique_status,
  'boutique status updated to pending_verification'
);

set local role anon;
select set_config('request.jwt.claims','{}',true);
select is(
  (select count(*)::integer from public.boutiques where id = 'a4000000-0000-4000-8000-000000000010'),
  0,
  'pending boutique is not publicly visible'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select ok(
  (select submitted_at is not null from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'submission has submitted timestamp'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'submitted') = 1,
  'submission creates verification event'
);

-- Check audit event (need elevated permissions)
set local role postgres;
select ok(
  (select count(*) from public.audit_events where entity_id = current_setting('tests.a04_submission_id') and action = 'boutique_verification.submitted') = 1,
  'submission creates audit event'
);

select ok(
  (select count(*) from public.outbox_events where aggregate_id = current_setting('tests.a04_submission_id') and event_type = 'verification_submitted') = 1,
  'submission creates outbox event'
);
set local role authenticated;

select is(
  (select status from public.boutique_verification_documents where submission_id = current_setting('tests.a04_submission_id')::uuid limit 1),
  'submitted'::text,
  'documents marked as submitted'
);

-- ============================================================================
-- TEST: submitted documents immutability
-- ============================================================================

-- Test that documents from submitted submission cannot be removed
do $$
begin
  perform public.owner_remove_verification_document(
    current_setting('tests.a04_doc1_id')::uuid
  );
  raise exception 'Expected exception was not raised';
exception when others then
  if sqlerrm not like '%cannot be removed%' and sqlerrm not like '%can only be removed from%' then
    raise exception 'Unexpected error: %', sqlerrm;
  end if;
end $$;

select pass('submitted documents cannot be removed');

-- ============================================================================
-- TEST: admin_read_verification_submission authorization
-- ============================================================================

select set_config('request.jwt.claims', null, true);
reset role;

select throws_ok(
  format(
    $$select public.admin_read_verification_submission('%s'::uuid)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Authentication required',
  'anonymous users cannot read verification submissions'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.admin_read_verification_submission('%s'::uuid)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Administrator AAL2 authentication required',
  'customers cannot read verification submissions via admin RPC'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  format(
    $$select public.admin_read_verification_submission('%s'::uuid)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Administrator AAL2 authentication required',
  'AAL1 admins cannot read verification submissions'
);

-- ============================================================================
-- TEST: admin_read_verification_submission success
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

select lives_ok(
  format(
    $$select public.admin_read_verification_submission('%s'::uuid)$$,
    current_setting('tests.a04_submission_id')
  ),
  'AAL2 admin can read verification submission'
);

do $$
declare
  v_submission jsonb;
begin
  select public.admin_read_verification_submission(
    current_setting('tests.a04_submission_id')::uuid
  ) into v_submission;

  if v_submission->>'legal_business_name' != 'Updated Fashion Studio Private Limited' then
    raise exception 'admin read did not return correct legal business name';
  end if;

  if v_submission->>'status' != 'submitted' then
    raise exception 'admin read did not return correct status';
  end if;

  if jsonb_array_length(v_submission->'documents') != 3 then
    raise exception 'admin read did not return correct document count';
  end if;

  if v_submission->'documents'->0->>'storage_object_key' is null then
    raise exception 'admin read did not include storage object keys';
  end if;
end $$;

select pass('admin read returns complete submission with documents and events');

-- ============================================================================
-- TEST: admin_approve_verification authorization
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, 'Approved')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Administrator AAL2 authentication required',
  'customers cannot approve verifications'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, 'Approved')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Administrator AAL2 authentication required',
  'boutique owners cannot approve verifications'
);

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, 'Approved')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Administrator AAL2 authentication required',
  'AAL1 admins cannot approve verifications'
);

-- ============================================================================
-- TEST: admin_approve_verification validation
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, '')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Approval reason is required',
  'approval with empty reason is rejected'
);

select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, null)$$,
    current_setting('tests.a04_submission_id')
  ),
  'Approval reason is required',
  'approval with null reason is rejected'
);

-- Test approval of suspended boutique
do $$
declare
  v_result jsonb;
  v_suspended_submission_id uuid;
begin
  -- First need to create and submit a verification for suspended boutique
  set local role postgres;
  update public.boutiques set status = 'draft' where id = 'a4000000-0000-4000-8000-000000000012';
  set local role authenticated;
  
  -- Switch to owner3 who owns the suspended boutique
  perform set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
  
  select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000012'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Suspended Business',
      'business_type', 'Private Limited',
      'registration_number', 'SUSP123',
      'pan', 'BBBBB2222B',
      'registered_address_line1', '456 Test St',
      'city', 'Bangalore',
      'state', 'Karnataka',
      'postal_code', '560001',
      'authorized_rep_name', 'Test',
      'authorized_rep_role', 'Director',
      'contact_email', 'test2@test.in',
      'contact_phone', '+911234567891'
    )
  ) into v_result;

  v_suspended_submission_id := (v_result->>'submission_id')::uuid;

  -- Attach required documents (use valid UUID format)
  perform public.owner_attach_verification_document(
    v_suspended_submission_id,
    'business_registration',
    'a4000000-0000-4000-8000-000000000012/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000031.pdf',
    'reg2.pdf',
    500000,
    'application/pdf'
  );
  
  perform public.owner_attach_verification_document(
    v_suspended_submission_id,
    'pan_document',
    'a4000000-0000-4000-8000-000000000012/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000032.jpg',
    'pan2.jpg',
    300000,
    'image/jpeg'
  );
  
  perform public.owner_attach_verification_document(
    v_suspended_submission_id,
    'address_proof',
    'a4000000-0000-4000-8000-000000000012/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000033.pdf',
    'addr2.pdf',
    400000,
    'application/pdf'
  );

  -- Submit
  perform public.owner_submit_verification(v_suspended_submission_id, 1);

  -- Suspend the boutique
  set local role postgres;
  update public.boutiques set status = 'suspended' where id = 'a4000000-0000-4000-8000-000000000012';
  set local role authenticated;

  perform set_config('tests.a04_suspended_submission_id', v_suspended_submission_id::text, false);
  
  -- Switch back to admin for next tests
  perform set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
end $$;

select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, 'Test approval')$$,
    current_setting('tests.a04_suspended_submission_id')
  ),
  'Cannot approve verification for suspended boutique',
  'approval of suspended boutique verification is rejected'
);

-- ============================================================================
-- TEST: admin_approve_verification success
-- ============================================================================

do $$
declare
  v_result jsonb;
begin
  select public.admin_approve_verification(
    current_setting('tests.a04_submission_id')::uuid,
    'All documents verified and in order. Business registration confirmed with ROC.'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'verification approval failed';
  end if;
end $$;

select pass('AAL2 admin can approve verification');

select is(
  (select status from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'approved'::text,
  'approved submission has approved status'
);

select is(
  (select status from public.boutiques where id = 'a4000000-0000-4000-8000-000000000010'),
  'verified'::public.boutique_status,
  'boutique status updated to verified'
);

select is(
  (select is_published from public.boutiques where id = 'a4000000-0000-4000-8000-000000000010'),
  true,
  'Admin approval publishes the verified boutique'
);

reset role;
select is(
  (select count(*)::integer from public.boutiques where id = 'a4000000-0000-4000-8000-000000000010'),
  1,
  'approved boutique is publicly visible'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

select ok(
  (select reviewed_at is not null from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'approved submission has reviewed timestamp'
);

select is(
  (select reviewing_admin_id from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'a4000000-0000-4000-8000-000000000006'::uuid,
  'approved submission records reviewing admin'
);

select ok(
  (select admin_decision_reason is not null from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid),
  'approved submission records admin reason'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid and event_type = 'approved') = 1,
  'approval creates verification event'
);

-- Check audit and outbox events (need elevated permissions)
set local role postgres;
select ok(
  (select count(*) from public.audit_events where entity_id = current_setting('tests.a04_submission_id') and action = 'boutique_verification.approved') = 1,
  'approval creates audit event'
);

select ok(
  (select count(*) from public.outbox_events where aggregate_id = current_setting('tests.a04_submission_id') and event_type = 'verification_approved') = 1,
  'approval creates outbox event'
);
set local role authenticated;

-- ============================================================================
-- TEST: admin_request_verification_changes workflow
-- ============================================================================

-- Create a new submission for changes request test
set local role postgres;
update public.boutiques
set status = 'draft', is_published = false
where id = 'a4000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);

do $$
declare
  v_result jsonb;
  v_changes_submission_id uuid;
begin
  select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000011'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Changes Request Test Business',
      'business_type', 'Sole Proprietorship',
      'registration_number', 'CRTEST123',
      'pan', 'CCCCC3333C',
      'registered_address_line1', '789 Test St',
      'city', 'Delhi',
      'state', 'Delhi',
      'postal_code', '110001',
      'authorized_rep_name', 'Test Owner',
      'authorized_rep_role', 'Proprietor',
      'contact_email', 'test3@test.in',
      'contact_phone', '+911234567892'
    )
  ) into v_result;

  v_changes_submission_id := (v_result->>'submission_id')::uuid;

  -- Attach required documents (use valid UUID format)
  perform public.owner_attach_verification_document(
    v_changes_submission_id,
    'business_registration',
    'a4000000-0000-4000-8000-000000000011/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000041.pdf',
    'reg3.pdf',
    500000,
    'application/pdf'
  );
  
  perform public.owner_attach_verification_document(
    v_changes_submission_id,
    'pan_document',
    'a4000000-0000-4000-8000-000000000011/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000042.jpg',
    'pan3.jpg',
    300000,
    'image/jpeg'
  );
  
  perform public.owner_attach_verification_document(
    v_changes_submission_id,
    'address_proof',
    'a4000000-0000-4000-8000-000000000011/a4000000-0000-4000-8000-000000000003/a4000000-0000-4000-8000-000000000043.pdf',
    'addr3.pdf',
    400000,
    'application/pdf'
  );

  -- Submit
  perform public.owner_submit_verification(v_changes_submission_id, 1);

  perform set_config('tests.a04_changes_submission_id', v_changes_submission_id::text, false);
end $$;

-- Admin requests changes
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

do $$
declare
  v_result jsonb;
begin
  select public.admin_request_verification_changes(
    current_setting('tests.a04_changes_submission_id')::uuid,
    'Please provide clearer address proof. Current document is not legible.'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'requesting changes failed';
  end if;
end $$;

select pass('AAL2 admin can request verification changes');

select is(
  (select status from public.boutique_verification_submissions where id = current_setting('tests.a04_changes_submission_id')::uuid),
  'changes_requested'::text,
  'submission status is changes_requested'
);

select is(
  (select status from public.boutiques where id = 'a4000000-0000-4000-8000-000000000011'),
  'draft'::public.boutique_status,
  'boutique status reverted to draft'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_changes_submission_id')::uuid and event_type = 'changes_requested') = 1,
  'changes request creates verification event'
);

-- Owner can resubmit after changes
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);

select lives_ok(
  format(
    $$select public.owner_update_verification_draft('%s'::uuid, jsonb_build_object(
      'legal_business_name', 'Changes Request Test Business Updated',
      'business_type', 'Sole Proprietorship',
      'registration_number', 'CRTEST123',
      'pan', 'CCCCC3333C',
      'registered_address_line1', '789 New Test St',
      'city', 'Delhi',
      'state', 'Delhi',
      'postal_code', '110001',
      'authorized_rep_name', 'Test Owner',
      'authorized_rep_role', 'Proprietor',
      'contact_email', 'test3@test.in',
      'contact_phone', '+911234567892'
    ), 2)$$,
    current_setting('tests.a04_changes_submission_id')
  ),
  'owner can update after changes requested'
);

select lives_ok(
  format(
    $$select public.owner_submit_verification('%s'::uuid, 3)$$,
    current_setting('tests.a04_changes_submission_id')
  ),
  'owner can resubmit after changes requested'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_changes_submission_id')::uuid and event_type = 'resubmitted') = 1,
  'resubmission creates resubmitted event'
);

-- ============================================================================
-- TEST: admin_reject_verification workflow
-- ============================================================================

-- Create a new submission for rejection test  
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

-- First clear the incomplete submission and recreate it properly
set local role postgres;
delete from public.boutique_verification_submissions where boutique_id = 'a4000000-0000-4000-8000-000000000013';
set local role authenticated;

do $$
declare
  v_result jsonb;
  v_reject_submission_id uuid;
begin
  select public.owner_create_verification_draft(
    'a4000000-0000-4000-8000-000000000013'::uuid,
    jsonb_build_object(
      'legal_business_name', 'Reject Test Business',
      'business_type', 'Partnership',
      'registration_number', 'REJECT123',
      'pan', 'DDDDD4444D',
      'registered_address_line1', '999 Test St',
      'city', 'Chennai',
      'state', 'Tamil Nadu',
      'postal_code', '600001',
      'authorized_rep_name', 'Test Partner',
      'authorized_rep_role', 'Managing Partner',
      'contact_email', 'test4@test.in',
      'contact_phone', '+911234567893'
    )
  ) into v_result;

  v_reject_submission_id := (v_result->>'submission_id')::uuid;

  -- Attach required documents (use valid UUID format)
  perform public.owner_attach_verification_document(
    v_reject_submission_id,
    'business_registration',
    'a4000000-0000-4000-8000-000000000013/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000051.pdf',
    'reg4.pdf',
    500000,
    'application/pdf'
  );
  
  perform public.owner_attach_verification_document(
    v_reject_submission_id,
    'pan_document',
    'a4000000-0000-4000-8000-000000000013/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000052.jpg',
    'pan4.jpg',
    300000,
    'image/jpeg'
  );
  
  perform public.owner_attach_verification_document(
    v_reject_submission_id,
    'address_proof',
    'a4000000-0000-4000-8000-000000000013/a4000000-0000-4000-8000-000000000002/a4000000-0000-4000-8000-000000000053.pdf',
    'addr4.pdf',
    400000,
    'application/pdf'
  );

  -- Submit
  perform public.owner_submit_verification(v_reject_submission_id, 1);

  perform set_config('tests.a04_reject_submission_id', v_reject_submission_id::text, false);
end $$;

-- Admin rejects
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

select throws_ok(
  format(
    $$select public.admin_reject_verification('%s'::uuid, '')$$,
    current_setting('tests.a04_reject_submission_id')
  ),
  'Rejection reason is required',
  'rejection with empty reason is rejected'
);

do $$
declare
  v_result jsonb;
begin
  select public.admin_reject_verification(
    current_setting('tests.a04_reject_submission_id')::uuid,
    'Business registration documents appear to be fraudulent. Multiple inconsistencies detected.'
  ) into v_result;

  if (v_result->>'success')::boolean != true then
    raise exception 'verification rejection failed';
  end if;
end $$;

select pass('AAL2 admin can reject verification');

select is(
  (select status from public.boutique_verification_submissions where id = current_setting('tests.a04_reject_submission_id')::uuid),
  'rejected'::text,
  'rejected submission has rejected status'
);

select is(
  (select status from public.boutiques where id = 'a4000000-0000-4000-8000-000000000013'),
  'rejected'::public.boutique_status,
  'boutique status set to rejected'
);

select is(
  (select is_published from public.boutiques where id = 'a4000000-0000-4000-8000-000000000013'),
  false,
  'rejected boutique is unpublished'
);

select ok(
  (select count(*) from public.boutique_verification_events where submission_id = current_setting('tests.a04_reject_submission_id')::uuid and event_type = 'rejected') = 1,
  'rejection creates verification event'
);

-- Check audit and outbox events (need elevated permissions)
set local role postgres;
select ok(
  (select count(*) from public.audit_events where entity_id = current_setting('tests.a04_reject_submission_id') and action = 'boutique_verification.rejected') = 1,
  'rejection creates audit event'
);

select ok(
  (select count(*) from public.outbox_events where aggregate_id = current_setting('tests.a04_reject_submission_id') and event_type = 'verification_rejected') = 1,
  'rejection creates outbox event'
);
set local role authenticated;

-- ============================================================================
-- TEST: Invalid state transitions
-- ============================================================================

select throws_ok(
  format(
    $$select public.admin_approve_verification('%s'::uuid, 'Test')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only submitted verifications can be approved',
  'cannot approve already-approved verification'
);

select throws_ok(
  format(
    $$select public.admin_request_verification_changes('%s'::uuid, 'Test')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only submitted verifications can have changes requested',
  'cannot request changes on already-approved verification'
);

select throws_ok(
  format(
    $$select public.admin_reject_verification('%s'::uuid, 'Test')$$,
    current_setting('tests.a04_submission_id')
  ),
  'Only submitted verifications can be rejected',
  'cannot reject already-approved verification'
);

-- ============================================================================
-- TEST: RLS enforcement for owner access
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);

select ok(
  (select count(*)::integer from public.boutique_verification_submissions where id = current_setting('tests.a04_submission_id')::uuid) = 1,
  'owner can read their own submission via RLS'
);

select is(
  (select count(*)::integer from public.boutique_verification_submissions where id = current_setting('tests.a04_changes_submission_id')::uuid),
  0,
  'owner cannot read other owners submissions via RLS'
);

select ok(
  (select count(*)::integer from public.boutique_verification_documents where submission_id = current_setting('tests.a04_submission_id')::uuid) = 3,
  'owner can read their own documents via RLS'
);

select is(
  (select count(*)::integer from public.boutique_verification_documents where submission_id = current_setting('tests.a04_changes_submission_id')::uuid),
  0,
  'owner cannot read other owners documents via RLS'
);

select ok(
  (select count(*)::integer from public.boutique_verification_events where submission_id = current_setting('tests.a04_submission_id')::uuid) > 0,
  'owner can read their own events via RLS'
);

-- ============================================================================
-- TEST: RLS enforcement for admin access
-- ============================================================================

select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);

select ok(
  (select count(*)::integer from public.boutique_verification_submissions) >= 3,
  'AAL2 admin can read all submissions via RLS'
);

select ok(
  (select count(*)::integer from public.boutique_verification_documents) >= 3,
  'AAL2 admin can read all documents via RLS'
);

select ok(
  (select count(*)::integer from public.boutique_verification_events) > 0,
  'AAL2 admin can read all events via RLS'
);

-- ============================================================================
-- TEST: Audit event masking
-- ============================================================================

-- Audit records must never retain raw tax identifiers (need elevated permissions)
set local role postgres;
select ok(
  not exists (
    select 1
    from public.audit_events
    where entity_id = current_setting('tests.a04_submission_id')
      and action in ('boutique_verification.submitted', 'boutique_verification.approved')
      and (coalesce(after_json, '{}'::jsonb)::text || coalesce(metadata, '{}'::jsonb)::text) like '%AABCT9999F%'
  ),
  'audit events never retain a raw PAN identifier'
);

select ok(
  not exists (
    select 1
    from public.audit_events
    where entity_id = current_setting('tests.a04_submission_id')
      and action in ('boutique_verification.submitted', 'boutique_verification.approved')
      and (coalesce(after_json, '{}'::jsonb)::text || coalesce(metadata, '{}'::jsonb)::text) like '%AABCT1234F%'
  ),
  'audit events never retain a previous raw PAN identifier'
);
reset role;

select * from finish();
rollback;
