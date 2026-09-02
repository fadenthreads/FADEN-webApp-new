begin;
select no_plan();

insert into auth.users(id,email) values
 ('a2000000-0000-4000-8000-000000000001','a02-customer@faden.local'),
 ('a2000000-0000-4000-8000-000000000002','a02-owner@faden.local'),
 ('a2000000-0000-4000-8000-000000000003','a02-admin@faden.local');
update public.profiles set role='boutique_owner' where id='a2000000-0000-4000-8000-000000000002';
update public.profiles set role='admin' where id='a2000000-0000-4000-8000-000000000003';

select throws_ok($$select public.admin_dashboard_summary()$$,'Authentication required','anonymous users are denied');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_dashboard_summary()$$,'Administrator AAL2 authentication required','customers are denied even at AAL2');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.admin_dashboard_summary()$$,'Administrator AAL2 authentication required','boutique owners are denied even at AAL2');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.admin_dashboard_summary()$$,'Administrator AAL2 authentication required','AAL1 admins are denied');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_dashboard_summary()$$,'AAL2 admins are allowed');
select is((public.admin_dashboard_summary()->>'time_range_days')::integer,30,'summary identifies its 30-day range');

reset role;
create temporary table a02_baseline as
select (s->>'gmv_paise')::bigint gmv,
       (s->>'active_orders_count')::integer active_orders,
       (s->>'pending_verification_count')::integer pending_boutiques
from (select public.admin_dashboard_summary() s) summary;
grant select on a02_baseline to authenticated;

insert into public.boutiques(id,owner_id,slug,name,status,is_published) values
 ('a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000002','a02-atelier','A02 Atelier','verified',true),
 ('a2000000-0000-4000-8000-000000000011',null,'a02-pending','A02 Pending','pending_verification',false);
insert into public.outfit_requests(id,user_id,status,draft) values
 ('a2000000-0000-4000-8000-000000000020','a2000000-0000-4000-8000-000000000001','submitted','{}'),
 ('a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000001','submitted','{}'),
 ('a2000000-0000-4000-8000-000000000022','a2000000-0000-4000-8000-000000000001','submitted','{}');
insert into public.request_shares(id,request_id,customer_id,boutique_id,client_label,brief) values
 ('a2000000-0000-4000-8000-000000000030','a2000000-0000-4000-8000-000000000020','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','A02 customer','{}'),
 ('a2000000-0000-4000-8000-000000000031','a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','A02 customer','{}'),
 ('a2000000-0000-4000-8000-000000000032','a2000000-0000-4000-8000-000000000022','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','A02 customer','{}');
insert into public.boutique_offers(id,share_id,request_id,customer_id,boutique_id,quote,subtotal_paise,tax_paise,total_paise,status) values
 ('a2000000-0000-4000-8000-000000000040','a2000000-0000-4000-8000-000000000030','a2000000-0000-4000-8000-000000000020','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','{"title":"A02 offer one"}',10000,0,10000,'accepted'),
 ('a2000000-0000-4000-8000-000000000041','a2000000-0000-4000-8000-000000000031','a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','{"title":"A02 offer two"}',20000,0,20000,'accepted'),
 ('a2000000-0000-4000-8000-000000000042','a2000000-0000-4000-8000-000000000032','a2000000-0000-4000-8000-000000000022','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','{"title":"A02 offer three"}',30000,0,30000,'accepted');
insert into public.customer_orders(id,request_id,offer_id,share_id,customer_id,boutique_id,boutique_owner_id,boutique_name,quote,subtotal_paise,tax_paise,total_paise,advance_paise,accepted_offer_version,status) values
 ('a2000000-0000-4000-8000-000000000050','a2000000-0000-4000-8000-000000000020','a2000000-0000-4000-8000-000000000040','a2000000-0000-4000-8000-000000000030','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000002','A02 Atelier','{}',10000,0,10000,5000,1,'test_advance_paid'),
 ('a2000000-0000-4000-8000-000000000051','a2000000-0000-4000-8000-000000000021','a2000000-0000-4000-8000-000000000041','a2000000-0000-4000-8000-000000000031','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000002','A02 Atelier','{}',20000,0,20000,10000,1,'awaiting_payment'),
 ('a2000000-0000-4000-8000-000000000052','a2000000-0000-4000-8000-000000000022','a2000000-0000-4000-8000-000000000042','a2000000-0000-4000-8000-000000000032','a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000002','A02 Atelier','{}',30000,0,30000,15000,1,'test_advance_paid');
insert into public.order_payment_attempts(id,order_id,customer_id,amount_paise,key_id,status,provider_order_id,provider_payment_id,verified_at) values
 ('a2000000-0000-4000-8000-000000000060','a2000000-0000-4000-8000-000000000050','a2000000-0000-4000-8000-000000000001',5000,'rzp_test_a02','captured','order_a02recent','pay_a02recent',now()-interval '1 day'),
 ('a2000000-0000-4000-8000-000000000061','a2000000-0000-4000-8000-000000000051','a2000000-0000-4000-8000-000000000001',10000,'rzp_test_a02','ready','order_a02ready',null,null),
 ('a2000000-0000-4000-8000-000000000062','a2000000-0000-4000-8000-000000000052','a2000000-0000-4000-8000-000000000001',15000,'rzp_test_a02','captured','order_a02old','pay_a02old',now()-interval '31 days');

select public.append_audit_event('order.a02_older','customer_order','a02-older','a2000000-0000-4000-8000-000000000003','admin',null,null,null);
select pg_sleep(0.01);
select public.append_audit_event('order.a02_newer','customer_order','a02-newer','a2000000-0000-4000-8000-000000000003','admin',null,null,null);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((public.admin_dashboard_summary()->>'gmv_paise')::bigint,(select gmv+5000 from a02_baseline),'GMV includes only recent captured payments');
select is((public.admin_dashboard_summary()->>'active_orders_count')::integer,(select active_orders+3 from a02_baseline),'active orders include paid and awaiting-payment orders');
select is((public.admin_dashboard_summary()->>'pending_verification_count')::integer,(select pending_boutiques+1 from a02_baseline),'pending verification count reflects boutique rows');
select is((public.admin_dashboard_summary()->>'open_disputes_count')::integer,0,'disputes are zero until their table exists');
select is((public.admin_dashboard_summary()->>'settlements_awaiting_count')::integer,0,'settlements are zero until their table exists');
select is(public.admin_dashboard_summary()->'recent_activity'->0->>'action','order.a02_newer','recent activity is newest first');
select is(jsonb_typeof(public.admin_dashboard_summary()->'recent_activity'),'array','recent activity is always an array');

select * from finish();
rollback;
