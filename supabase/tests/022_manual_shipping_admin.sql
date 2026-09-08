begin;
select no_plan();

insert into auth.users(id,email) values
 ('b2000000-0000-4000-8000-000000000001','l02-customer@faden.local'),
 ('b2000000-0000-4000-8000-000000000002','l02-admin@faden.local');
update public.profiles set role='admin' where id='b2000000-0000-4000-8000-000000000002';

select throws_ok($$select public.admin_list_orders()$$, 'Administrator MFA is required', 'anonymous users cannot list orders');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_list_orders()$$, 'Administrator MFA is required', 'customers cannot list orders');
select set_config('request.jwt.claims','{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_list_orders()$$, 'Administrator MFA is required', 'AAL1 admins cannot list orders');
select set_config('request.jwt.claims','{"sub":"b2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_list_orders()$$, 'AAL2 admin can list orders');
select lives_ok($$select public.admin_list_orders(p_queue := 'shipping')$$, 'AAL2 admin can open manual shipping queue');
select throws_ok($$select public.admin_list_orders(p_queue := 'courier')$$, 'Invalid queue', 'invalid queue is rejected');
select throws_ok($$select public.admin_reveal_order_address('00000000-0000-0000-0000-000000000000','reason')$$, 'No delivery address is available', 'address access cannot fabricate an address');
select throws_ok($$select public.admin_upsert_manual_shipment('00000000-0000-0000-0000-000000000000',0,'Carrier','TRACK','https://example.com','booked',null,false)$$, 'A confirmed captured payment is required before shipping', 'unpaid or nonexistent order cannot ship');
select throws_ok($$select * from public.manual_order_shipments$$, '42501', 'permission denied for table manual_order_shipments', 'shipment rows have no direct authenticated access');
select throws_ok($$select * from public.admin_order_notes$$, '42501', 'permission denied for table admin_order_notes', 'private notes have no direct authenticated access');
select * from finish();
rollback;
