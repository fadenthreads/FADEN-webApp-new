begin;
select no_plan();

insert into auth.users(id,email) values
 ('e5000000-0000-4000-8000-000000000001','l05-customer@faden.local'),
 ('e5000000-0000-4000-8000-000000000002','l05-admin@faden.local');
update public.profiles set role='admin' where id='e5000000-0000-4000-8000-000000000002';

select throws_ok($$select public.admin_email_delivery_summary()$$, 'Administrator MFA is required', 'anonymous users cannot read email delivery operations');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_email_delivery_summary()$$, 'Administrator MFA is required', 'customers cannot read email delivery operations');
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_email_delivery_summary()$$, 'Administrator MFA is required', 'AAL1 admins cannot read email delivery operations');
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_email_delivery_summary()$$, 'AAL2 admins can read safe email delivery operations');

reset role;
insert into public.outbox_events(event_type,aggregate_type,aggregate_id,status,attempts,last_error)
values ('manual_shipment.updated','customer_order','e5000000-0000-4000-8000-000000000099','failed',5,'provider diagnostic must not reach admin');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((public.admin_email_delivery_summary()->>'failed_count')::integer, 1, 'failed count is available to AAL2 admins');
select is(public.admin_email_delivery_summary()->'failed_events'->0->>'event_type', 'manual_shipment.updated', 'safe event type is visible');
select is(public.admin_email_delivery_summary()->'failed_events'->0 ? 'payload', false, 'outbox payload is never exposed to admin summary');

select * from finish();
rollback;
