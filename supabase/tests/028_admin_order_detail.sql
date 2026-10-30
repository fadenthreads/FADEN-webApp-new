begin;
select no_plan();

insert into auth.users(id,email) values
 ('b8000000-0000-4000-8000-000000000001','detail-customer@faden.local'),
 ('b8000000-0000-4000-8000-000000000002','detail-admin@faden.local'),
 ('b8000000-0000-4000-8000-000000000003','detail-owner@faden.local');
update public.profiles set role='admin' where id='b8000000-0000-4000-8000-000000000002';
update public.profiles set display_name='Detail Customer' where id='b8000000-0000-4000-8000-000000000001';
insert into public.boutiques(id,owner_id,slug,name) values
 ('b8000000-0000-4000-8000-000000000004','b8000000-0000-4000-8000-000000000003','detail-test-atelier','Detail Test Atelier');
insert into public.outfit_requests(id,user_id) values
 ('b8000000-0000-4000-8000-000000000005','b8000000-0000-4000-8000-000000000001');
insert into public.request_shares(id,request_id,customer_id,boutique_id,client_label,brief) values
 ('b8000000-0000-4000-8000-000000000006','b8000000-0000-4000-8000-000000000005','b8000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000004','Test customer','{}');
insert into public.boutique_offers(id,share_id,request_id,customer_id,boutique_id) values
 ('b8000000-0000-4000-8000-000000000007','b8000000-0000-4000-8000-000000000006','b8000000-0000-4000-8000-000000000005','b8000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000004');
insert into public.customer_orders(id,request_id,offer_id,share_id,customer_id,boutique_id,boutique_owner_id,boutique_name,quote,subtotal_paise,tax_paise,total_paise,advance_paise,accepted_offer_version) values
 ('b8000000-0000-4000-8000-000000000008','b8000000-0000-4000-8000-000000000005','b8000000-0000-4000-8000-000000000007','b8000000-0000-4000-8000-000000000006','b8000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000004','b8000000-0000-4000-8000-000000000003','Detail Test Atelier','{}',10000,0,10000,10000,1);

select ok(not has_function_privilege('anon','public.admin_read_order_detail(uuid)','EXECUTE'),'anonymous cannot execute detail RPC');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')$$,'Administrator MFA is required','customer cannot read admin order detail');
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')$$,'Administrator MFA is required','boutique owner cannot read admin detail');
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')$$,'Administrator MFA is required','AAL1 admin cannot read detail');
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')$$,'AAL2 admin reads an actual unpaid order');
select is(public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')#>>'{customer,email}','detail-customer@faden.local','email comes from auth.users');
select is(public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')#>>'{customer,display_name}','Detail Customer','display name comes from profiles');
select is(public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')->'payments','[]'::jsonb,'unpaid order has empty payment history');
select ok(not ((public.admin_read_order_detail('b8000000-0000-4000-8000-000000000008')->'order') ?| array['customer_id','boutique_owner_id','address']),'detail excludes private identity keys and delivery address');
select throws_ok($$select public.admin_read_order_detail('00000000-0000-0000-0000-000000000000')$$,'Order not found','missing order remains an error');
select * from finish();
rollback;
