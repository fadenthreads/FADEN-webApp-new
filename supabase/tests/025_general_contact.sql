begin;
select no_plan();

set local role anon;
select lives_ok(
  $$select public.submit_contact_inquiry('Launch Visitor','visitor@example.com','general','I would like to know more about FADEN services.')$$,
  'anonymous visitor can submit a valid contact enquiry'
);
select throws_ok(
  $$select public.submit_contact_inquiry('X','bad','unknown','short')$$,
  'Invalid contact inquiry',
  'invalid contact content is rejected'
);

reset role;
select is(
  (select count(*) from public.contact_inquiries where email='visitor@example.com'),
  1::bigint,
  'contact enquiry is persisted'
);
select throws_ok(
  $$select * from public.admin_list_contact_inquiries(null,100)$$,
  'Administrator MFA is required',
  'anonymous users cannot list contact enquiries'
);

insert into auth.users(id,email) values ('a6000000-0000-4000-8000-000000000001','contact-admin@faden.local');
update public.profiles set role='admin' where id='a6000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.admin_list_contact_inquiries(null,100)$$,
  'AAL2 admin can list contact enquiries'
);
select lives_ok(
  format($$select public.admin_update_contact_inquiry('%s'::uuid,'resolved')$$,
    (select id from public.contact_inquiries where email='visitor@example.com')),
  'AAL2 admin can resolve a contact enquiry'
);

reset role;
select is(
  (select status from public.contact_inquiries where email='visitor@example.com'),
  'resolved',
  'admin status change is persisted'
);

select * from finish();
rollback;
