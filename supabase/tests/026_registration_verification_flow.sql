begin;
select no_plan();
insert into auth.users(id,email) values
 ('f4300000-0000-4000-8000-000000000001','isolated-registration@faden.local');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f4300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
create temporary table journey_registration as
select public.create_boutique_application(
 'ISOLATED REGISTRATION TEST', 'isolated-registration-regression',
 'Hyderabad', 'Synthetic test only'
) as id;
select is((select status::text from public.boutiques where id=(select id from journey_registration)),
 'pending_verification', 'registration starts pending verification');
create temporary table journey_details as select jsonb_build_object(
 'legal_business_name','ISOLATED TEST ONLY', 'business_type','Private Limited',
 'registration_number','TEST-ONLY', 'pan','AAAAA1111A',
 'registered_address_line1','42 Fictional Street','city','Hyderabad',
 'state','Telangana','postal_code','500001','authorized_rep_name','Test Owner',
 'authorized_rep_role','Test','contact_email','isolated-registration@faden.local',
 'contact_phone','+919876543210'
) as details;
select lives_ok($$select public.owner_create_verification_draft(
 (select id from journey_registration), (select details from journey_details))$$,
 'newly registered owner can start verification without changing boutique status');
select throws_ok($$select public.owner_create_verification_draft(
 (select id from journey_registration), (select details from journey_details))$$,
 'A draft verification already exists for this boutique', 'duplicate drafts are blocked');
select is((select is_published from public.boutiques where id=(select id from journey_registration)),
 false, 'starting verification does not publish boutique');
reset role;
update public.boutique_verification_submissions set status='submitted'
 where boutique_id=(select id from journey_registration);
set local role authenticated;
select throws_ok($$select public.owner_create_verification_draft(
 (select id from journey_registration), (select details from journey_details))$$,
 'An active verification already exists for this boutique', 'submitted applications cannot be bypassed by creating another draft');
select * from finish();
rollback;
