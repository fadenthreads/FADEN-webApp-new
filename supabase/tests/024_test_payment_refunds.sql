begin;
select no_plan();

insert into auth.users(id,email) values
 ('f6000000-0000-4000-8000-000000000001','l06-customer@faden.local'),
 ('f6000000-0000-4000-8000-000000000002','l06-admin@faden.local');
update public.profiles set role='admin' where id='f6000000-0000-4000-8000-000000000002';

select ok(not has_table_privilege('authenticated','public.payment_provider_events','SELECT'), 'provider events are not browser-readable');
select ok(not has_table_privilege('authenticated','public.payment_refunds','SELECT'), 'refund ledger is not browser-readable');
select ok(not has_function_privilege('authenticated','public.record_test_provider_event(text,text,text,text)','EXECUTE'), 'only worker can record provider event IDs');
select ok(not has_function_privilege('authenticated','public.record_test_refund_outcome(text,text)','EXECUTE'), 'only worker can confirm a refund');

select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',100,'test')$$, 'Administrator MFA is required', 'anonymous users cannot request refunds');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',100,'test')$$, 'Administrator MFA is required', 'customers cannot request refunds');
select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',100,'test')$$, 'Administrator MFA is required', 'AAL1 admins cannot request refunds');
select set_config('request.jwt.claims','{"sub":"f6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',0,'test')$$, 'Refund amount is invalid', 'refund amount must be positive');
select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',100,'x')$$, 'Refund reason is required', 'refund reason is bounded');
select throws_ok($$select public.admin_create_test_refund('00000000-0000-4000-8000-000000000000',100,'test')$$, 'Captured payment not found', 'AAL2 admin cannot fabricate a refund');

select * from finish();
rollback;
