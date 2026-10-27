begin;
select no_plan();
insert into auth.users(id,email) values
 ('f4500000-0000-4000-8000-000000000001','waiver-owner@faden.local'),
 ('f4500000-0000-4000-8000-000000000002','waiver-admin@faden.local');
update public.profiles set role='admin' where id='f4500000-0000-4000-8000-000000000002';
insert into public.boutiques(id,owner_id,name,slug,city,status) values
 ('f4500000-0000-4000-8000-000000000010','f4500000-0000-4000-8000-000000000001','ISOLATED Waiver Test','isolated-waiver-test','Hyderabad','pending_verification'),
 ('f4500000-0000-4000-8000-000000000011','f4500000-0000-4000-8000-000000000001','ISOLATED Suspended','isolated-waiver-suspended','Hyderabad','suspended');
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','Test review',true)$$,'Administrator MFA is required','anonymous denial');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f4500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','Test review',true)$$,'Administrator MFA is required','owner cannot self approve');
select set_config('request.jwt.claims','{"sub":"f4500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','Test review',true)$$,'Administrator MFA is required','AAL1 admin denied');
select set_config('request.jwt.claims','{"sub":"f4500000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','Test review',false)$$,'Confirm approval without official documents','confirmation required');
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010',' ',true)$$,'Provide an approval reason between 3 and 1000 characters','reason required');
select throws_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000011','Test review',true)$$,'Only pending or draft boutiques can receive document-free approval','cannot bypass suspension');
select lives_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','ISOLATED no-document review',true)$$,'AAL2 admin approves without a document submission');
select lives_ok($$select public.admin_approve_boutique_without_documents('f4500000-0000-4000-8000-000000000010','ISOLATED retry',true)$$,'retry is idempotent');
reset role;
select is((select is_published from public.boutiques where id='f4500000-0000-4000-8000-000000000010'),true,'approval publishes selected boutique');
select is((select count(*)::integer from public.boutique_verification_submissions where boutique_id='f4500000-0000-4000-8000-000000000010'),0,'no fabricated verification or documents');
select is((select count(*)::integer from public.audit_events where entity_id='f4500000-0000-4000-8000-000000000010' and action='boutique.approved_without_documents'),1,'one explicit waiver audit');
select is((select count(*)::integer from public.outbox_events where aggregate_id='f4500000-0000-4000-8000-000000000010' and event_type='boutique.approved_without_documents'),1,'one owner approval notification queued');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*)::integer from public.boutiques where id='f4500000-0000-4000-8000-000000000010'),1,'approved boutique visible to customers');
select is((select count(*)::integer from public.boutiques where id='f4500000-0000-4000-8000-000000000011'),0,'suspended boutique remains hidden');
select * from finish();
rollback;
