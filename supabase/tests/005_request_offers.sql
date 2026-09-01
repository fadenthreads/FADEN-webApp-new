begin;
select no_plan();
insert into auth.users(id,email) values
('fb000000-0000-4000-8000-000000000001','share-customer@faden.local'),
('fb000000-0000-4000-8000-000000000002','share-owner@faden.local'),
('fb000000-0000-4000-8000-000000000003','share-outsider@faden.local');
insert into public.boutiques(id,owner_id,slug,name,status,is_published) values
('fb000000-0000-4000-8000-000000000010','fb000000-0000-4000-8000-000000000002','share-test-atelier','Test Atelier','verified',true);
insert into public.outfit_requests(id,user_id,status,draft) values
('fb000000-0000-4000-8000-000000000020','fb000000-0000-4000-8000-000000000001','submitted','{"occasion":"Wedding","garment":"Lehenga","notes":"Shared note","measurements":{"chest":"90"},"links":["https://example.com"],"inspirations":[],"privateFutureField":"SECRET"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.share_outfit_request('fb000000-0000-4000-8000-000000000020','fb000000-0000-4000-8000-000000000010',false,false,false)$$,'P0001',null,'consent required');
select set_config('test.share',public.share_outfit_request('fb000000-0000-4000-8000-000000000020','fb000000-0000-4000-8000-000000000010',false,false,true)::text,true);
select is(public.share_outfit_request('fb000000-0000-4000-8000-000000000020','fb000000-0000-4000-8000-000000000010',false,false,true)::text,current_setting('test.share'),'sharing retry is idempotent');
select ok((select not (brief ? 'measurements') and not (brief ? 'inspirations') and not (brief ? 'links') and not (brief ? 'privateFutureField') from public.request_shares where id=current_setting('test.share')::uuid),'snapshot excludes optional and unknown private fields');
select ok(not has_table_privilege('authenticated','public.request_shares','INSERT'),'sharing cannot bypass consent RPC');
select ok(not has_table_privilege('authenticated','public.boutique_offers','UPDATE'),'offer status/totals cannot be edited directly');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.request_shares where id=current_setting('test.share')::uuid),0,'uninvited user cannot read shared brief');
select throws_ok($$select public.share_outfit_request('fb000000-0000-4000-8000-000000000020','fb000000-0000-4000-8000-000000000010',true,true,true)$$,'P0001',null,'other user cannot share the request');
select set_config('test.quote',jsonb_build_object('title','Bespoke Lehenga','items',jsonb_build_array(jsonb_build_object('label','Silk','detail','Silk fabric','quantity',2,'unit_paise',125050)),'tax_bps',500,'advance_paise',50000,'delivery_date',(current_date+40)::text,'expires_on',(current_date+7)::text,'terms','Includes two fitting sessions.')::text,true);
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,0,current_setting('test.quote')::jsonb,false)$$,'P0001',null,'uninvited user cannot quote');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.request_shares where id=current_setting('test.share')::uuid),1,'invited owner sees snapshot');
select is((select count(*)::integer from public.outfit_requests where id='fb000000-0000-4000-8000-000000000020'),0,'invited owner still cannot read private original');
select lives_ok($$insert into public.atelier_request_notes(share_id,notes) values(current_setting('test.share')::uuid,'PRIVATE SOURCING NOTE')$$,'atelier owner can save internal notes');
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,0,jsonb_set(current_setting('test.quote')::jsonb,'{title}','"   "'),true)$$,'23514',null,'direct RPC cannot publish a blank title');
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,0,jsonb_set(current_setting('test.quote')::jsonb,'{advance_paise}','999999999'),false)$$,'P0001',null,'advance cannot exceed total');
select set_config('test.offer',public.save_boutique_offer(current_setting('test.share')::uuid,0,current_setting('test.quote')::jsonb,false)::text,true);
select is((select total_paise from public.boutique_offers where id=current_setting('test.offer')::uuid),262605::bigint,'database computes exact line totals and rounded tax');
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,0,current_setting('test.quote')::jsonb,false)$$,'P0001',null,'stale draft update denied');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.boutique_offers where id=current_setting('test.offer')::uuid),0,'customer cannot see unsent offer');
select is((select count(*)::integer from public.atelier_request_notes where share_id=current_setting('test.share')::uuid),0,'customer cannot read internal notes');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,1,current_setting('test.quote')::jsonb,true)$$,'owner sends offer');
select lives_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,1,current_setting('test.quote')::jsonb,true)$$,'send retry returns same offer');
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,2,current_setting('test.quote')::jsonb,false)$$,'P0001',null,'sent quote is immutable');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.boutique_offers where id=current_setting('test.offer')::uuid),0,'other customer cannot read sent offer');
select throws_ok($$select public.close_boutique_offer(current_setting('test.offer')::uuid,2,'declined')$$,'P0001',null,'other customer cannot decline offer');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.boutique_offers where id=current_setting('test.offer')::uuid),1,'customer sees sent quote');
select lives_ok($$select public.revoke_request_share(current_setting('test.share')::uuid)$$,'customer revokes invitation');
select is((select status from public.boutique_offers where id=current_setting('test.offer')::uuid),'withdrawn','revocation withdraws sent quote');
select set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.request_shares where id=current_setting('test.share')::uuid),0,'revocation removes boutique read access');
select throws_ok($$select public.save_boutique_offer(current_setting('test.share')::uuid,3,current_setting('test.quote')::jsonb,true)$$,'P0001',null,'revocation prevents new offers');
reset role;
select is((select count(*)::integer from public.outbox_events where aggregate_id=current_setting('test.offer') and event_type='offer.sent'),1,'send retries emit one outbox event');
select * from finish();
rollback;
