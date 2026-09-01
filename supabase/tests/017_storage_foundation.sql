begin;
select no_plan();

insert into auth.users(id,email) values
 ('fe000000-0000-4000-8000-000000000001','storage-customer@faden.local'),
 ('fe000000-0000-4000-8000-000000000002','storage-owner@faden.local'),
 ('fe000000-0000-4000-8000-000000000003','storage-outsider@faden.local'),
 ('fe000000-0000-4000-8000-000000000004','storage-staff@faden.local'),
 ('fe000000-0000-4000-8000-000000000005','storage-admin@faden.local'),
 ('fe000000-0000-4000-8000-000000000006','storage-owner-b@faden.local');
update public.profiles set role='admin' where id='fe000000-0000-4000-8000-000000000005';
update public.profiles set role='boutique_staff' where id='fe000000-0000-4000-8000-000000000004';
insert into public.boutiques(id,owner_id,slug,name,status,is_published) values
 ('fe000000-0000-4000-8000-000000000010','fe000000-0000-4000-8000-000000000002','storage-atelier-a','Storage Atelier A','verified',true),
 ('fe000000-0000-4000-8000-000000000011','fe000000-0000-4000-8000-000000000006','storage-atelier-b','Storage Atelier B','verified',true),
 ('fe000000-0000-4000-8000-000000000012','fe000000-0000-4000-8000-000000000002','storage-atelier-s','Storage Atelier Suspended','verified',true);
insert into public.boutique_members(boutique_id,user_id,role) values
 ('fe000000-0000-4000-8000-000000000010','fe000000-0000-4000-8000-000000000002','boutique_owner'),
 ('fe000000-0000-4000-8000-000000000010','fe000000-0000-4000-8000-000000000004','boutique_staff'),
 ('fe000000-0000-4000-8000-000000000011','fe000000-0000-4000-8000-000000000006','boutique_owner'),
 ('fe000000-0000-4000-8000-000000000012','fe000000-0000-4000-8000-000000000002','boutique_owner'),
 ('fe000000-0000-4000-8000-000000000012','fe000000-0000-4000-8000-000000000004','boutique_staff');
insert into public.outfit_requests(id,user_id,status,draft) values
 ('fe000000-0000-4000-8000-000000000020','fe000000-0000-4000-8000-000000000001','submitted','{"occasion":"Wedding"}');
insert into public.request_shares(id,request_id,customer_id,boutique_id,client_label,brief,include_inspiration) values
 ('fe000000-0000-4000-8000-000000000021','fe000000-0000-4000-8000-000000000020','fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000010','Customer','{}',true),
 ('fe000000-0000-4000-8000-000000000022','fe000000-0000-4000-8000-000000000020','fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000011','Customer','{}',false);
insert into public.boutique_offers(id,share_id,request_id,customer_id,boutique_id,quote,subtotal_paise,tax_paise,total_paise,status,sent_at) values
 ('fe000000-0000-4000-8000-000000000030','fe000000-0000-4000-8000-000000000021','fe000000-0000-4000-8000-000000000020','fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000010','{"title":"Storage fixture"}',10000,0,10000,'accepted',now());
insert into public.customer_orders(id,request_id,offer_id,share_id,customer_id,boutique_id,boutique_owner_id,boutique_name,quote,subtotal_paise,tax_paise,total_paise,advance_paise,accepted_offer_version) values
 ('fe000000-0000-4000-8000-000000000040','fe000000-0000-4000-8000-000000000020','fe000000-0000-4000-8000-000000000030','fe000000-0000-4000-8000-000000000021','fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000010','fe000000-0000-4000-8000-000000000002','Storage Atelier A','{"title":"Storage fixture"}',10000,0,10000,5000,1);

select ok((select public and file_size_limit=10485760 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] from storage.buckets where id='portfolio-images'),'portfolio-images is public, 10MB, image MIME only');
select ok((select not public and file_size_limit=10485760 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] from storage.buckets where id='request-inspirations'),'request-inspirations is private, 10MB, image MIME only');
select ok((select not public and file_size_limit=15728640 and allowed_mime_types @> array['image/jpeg','application/pdf'] from storage.buckets where id='order-files'),'order-files is private with 15MB PDF-capable limit');
select ok((select not public and file_size_limit=15728640 and allowed_mime_types @> array['application/pdf'] from storage.buckets where id='verification-documents'),'verification-documents is private with 15MB PDF limit');
select ok(not has_function_privilege('anon','public.can_read_verification_document(text)','EXECUTE'),'anonymous cannot execute verification helpers');
select ok(has_function_privilege('authenticated','public.can_write_portfolio_image(text)','EXECUTE'),'signed-in storage helpers granted');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000050.jpg')$$,'boutique member can upload portfolio image');
select lives_ok($$insert into storage.objects(bucket_id,name) values('verification-documents','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000051.pdf')$$,'boutique owner can upload verification document');
select lives_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/atelier/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000052.jpg')$$,'original boutique owner can upload atelier order file');
select throws_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/customer/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000053.jpg')$$,'42501',null,'boutique owner cannot write customer-purpose order files');
select throws_ok($$insert into storage.objects(bucket_id,name) values('request-inspirations','fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000054.jpg')$$,'42501',null,'shared boutique cannot write request inspirations');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select lives_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000055.jpg')$$,'authorized staff can upload portfolio image under their user id');
select throws_ok($$insert into storage.objects(bucket_id,name) values('verification-documents','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000056.pdf')$$,'42501',null,'staff cannot upload verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/atelier/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000057.jpg')$$,'42501',null,'staff who are not the original owner cannot write order files');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$insert into storage.objects(bucket_id,name) values('request-inspirations','fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000058.jpg')$$,'request owner can upload inspiration');
select lives_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/customer/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000059.jpg')$$,'order customer can upload customer-purpose file');
select lives_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/shared/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000060.pdf')$$,'order customer can upload shared-purpose PDF');
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations' and name='fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000058.jpg'),1,'owner can read own inspiration');
select is((select count(*)::integer from storage.objects where bucket_id='order-files' and name='fe000000-0000-4000-8000-000000000040/atelier/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000052.jpg'),1,'customer can read atelier order file');
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'customer cannot read verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000061.jpg')$$,'42501',null,'customer cannot write boutique portfolio');
select throws_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/atelier/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000062.jpg')$$,'42501',null,'customer cannot write atelier-purpose order files');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations' and name='fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000058.jpg'),1,'shared boutique with inspiration consent can read request image');
select is((select count(*)::integer from storage.objects where bucket_id='order-files' and name='fe000000-0000-4000-8000-000000000040/customer/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000059.jpg'),1,'original boutique owner can read customer order file');
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents' and name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000051.pdf'),1,'submitting boutique owner can read verification document');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations'),0,'boutique shared without inspiration consent cannot read request images');
select is((select count(*)::integer from storage.objects where bucket_id='order-files'),0,'unrelated boutique cannot read order files');
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'unrelated boutique cannot read verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('request-inspirations','fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000063.jpg')$$,'42501',null,'unrelated boutique cannot upload request inspirations');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations'),0,'unrelated user cannot read request inspirations');
select is((select count(*)::integer from storage.objects where bucket_id='order-files'),0,'unrelated user cannot read order files');
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'unrelated user cannot read verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('request-inspirations','fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000020/fe000000-0000-4000-8000-000000000064.jpg')$$,'42501',null,'unrelated user cannot upload request inspirations');
select throws_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/shared/fe000000-0000-4000-8000-000000000003/fe000000-0000-4000-8000-000000000065.jpg')$$,'42501',null,'unrelated user cannot upload order files');
select throws_ok($$insert into storage.objects(bucket_id,name) values('verification-documents','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000003/fe000000-0000-4000-8000-000000000066.pdf')$$,'42501',null,'unrelated user cannot upload verification documents');
select is((select count(*)::integer from storage.objects where bucket_id='portfolio-images' and name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000050.jpg'),1,'public portfolio images remain readable to signed-in users');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'AAL1 admin cannot read verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('verification-documents','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000005/fe000000-0000-4000-8000-000000000067.pdf')$$,'42501',null,'admin cannot upload boutique verification documents');
select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents' and name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000051.pdf'),1,'AAL2 admin can read verification documents');
select throws_ok($$delete from storage.objects where bucket_id='verification-documents' and name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000051.pdf'$$,'42501',null,'AAL2 admin cannot delete verification documents');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'non-admin AAL2 session cannot read verification documents');

reset role;
update public.request_shares set revoked_at=now() where id='fe000000-0000-4000-8000-000000000021';
delete from public.boutique_members where boutique_id='fe000000-0000-4000-8000-000000000010' and user_id='fe000000-0000-4000-8000-000000000004';
update public.boutiques set status='suspended' where id='fe000000-0000-4000-8000-000000000012';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations'),0,'revoked share removes boutique inspiration read access');
select throws_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000012/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000068.jpg')$$,'42501',null,'suspended boutique membership cannot upload portfolio images');

select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000069.jpg')$$,'42501',null,'revoked staff cannot upload portfolio images');
select is((select count(*)::integer from storage.objects where name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000055.jpg'),1,'revoked staff still see public portfolio objects but cannot replace them');
select throws_ok($$delete from storage.objects where name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000004/fe000000-0000-4000-8000-000000000055.jpg'$$,'42501',null,'revoked staff cannot delete previously uploaded portfolio images');

reset role;
update public.boutiques set status='suspended' where id='fe000000-0000-4000-8000-000000000010';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='order-files'),0,'suspended original owner loses order-file access');
select throws_ok($$insert into storage.objects(bucket_id,name) values('order-files','fe000000-0000-4000-8000-000000000040/atelier/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000071.jpg')$$,'42501',null,'suspended original owner cannot write order files');
select set_config('request.jwt.claims','{"sub":"fe000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='order-files'),3,'customer retains order-file access after boutique suspension');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='portfolio-images' and name='fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000002/fe000000-0000-4000-8000-000000000050.jpg'),1,'anonymous can read public portfolio images');
select is((select count(*)::integer from storage.objects where bucket_id='request-inspirations'),0,'anonymous cannot read request inspirations');
select is((select count(*)::integer from storage.objects where bucket_id='order-files'),0,'anonymous cannot read order files');
select is((select count(*)::integer from storage.objects where bucket_id='verification-documents'),0,'anonymous cannot read verification documents');
select throws_ok($$insert into storage.objects(bucket_id,name) values('portfolio-images','fe000000-0000-4000-8000-000000000010/fe000000-0000-4000-8000-000000000001/fe000000-0000-4000-8000-000000000070.jpg')$$,'42501',null,'anonymous cannot write public portfolio bucket');

reset role;
select * from finish();
rollback;
