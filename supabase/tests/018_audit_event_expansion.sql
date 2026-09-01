begin;
select no_plan();

insert into auth.users(id,email) values
 ('ae000000-0000-4000-8000-000000000001','audit-customer@faden.local'),
 ('ae000000-0000-4000-8000-000000000002','audit-owner@faden.local'),
 ('ae000000-0000-4000-8000-000000000003','audit-staff@faden.local'),
 ('ae000000-0000-4000-8000-000000000004','audit-admin@faden.local'),
 ('ae000000-0000-4000-8000-000000000005','audit-target@faden.local');
update public.profiles set role='admin' where id='ae000000-0000-4000-8000-000000000004';
update public.profiles set role='boutique_owner' where id='ae000000-0000-4000-8000-000000000002';
update public.profiles set role='boutique_staff' where id='ae000000-0000-4000-8000-000000000003';
insert into public.boutiques(id,owner_id,slug,name,status,is_published) values
 ('ae000000-0000-4000-8000-000000000010','ae000000-0000-4000-8000-000000000002','audit-atelier','Audit Atelier','verified',true);
insert into public.boutique_members(boutique_id,user_id,role) values
 ('ae000000-0000-4000-8000-000000000010','ae000000-0000-4000-8000-000000000002','boutique_owner'),
 ('ae000000-0000-4000-8000-000000000010','ae000000-0000-4000-8000-000000000003','boutique_staff');

select has_function('public','append_audit_event',array['text','text','text','uuid','app_role','text','jsonb','jsonb','text','text','text','jsonb'],'append helper exists');
select has_function('public','record_audit_event',array['text','text','text','text','jsonb','jsonb','text','text','text'],'record helper exists');
select ok(not has_function_privilege('authenticated','public.append_audit_event(text,text,text,uuid,app_role,text,jsonb,jsonb,text,text,text,jsonb)','EXECUTE'),'append_audit_event is not callable by API roles');
select ok(has_function_privilege('authenticated','public.record_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)','EXECUTE'),'record_audit_event granted to authenticated');

select is(public.sanitize_audit_json('{"status":"verified","password":"secret"}'::jsonb), '{"status":"verified"}'::jsonb, 'sanitizer drops blocked keys');
select is(public.sanitize_audit_json('{"measurement_profile":{"bust":34}}'::jsonb), null, 'sanitizer rejects non-allowlisted keys');
select is(public.normalize_audit_request_id(' req-ABC_123 '), 'req-abc123', 'request id normalized');
select is(public.normalize_audit_user_agent('  Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0 '), 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0', 'user agent trimmed');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ae000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.audit_events),0,'normal user cannot read audit events');
select throws_ok($$insert into public.audit_events(action,entity_type) values('test.direct','profile')$$,'42501',null,'normal user cannot insert audit events directly');
select throws_ok($$update public.audit_events set action='changed' where id=1$$,'42501',null,'normal user cannot update audit events');
select throws_ok($$delete from public.audit_events where id=1$$,'42501',null,'normal user cannot delete audit events');
select throws_ok($$select public.record_audit_event('design.published','design','fake-design',null,null,null,null,null,null)$$,'P0001',null,'normal user cannot inject workflow audit events through RPC');

select set_config('request.jwt.claims','{"sub":"ae000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.audit_events),0,'boutique owner cannot read audit events');
select set_config('request.jwt.claims','{"sub":"ae000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.audit_events),0,'boutique staff cannot read audit events');

select set_config('request.jwt.claims','{"sub":"ae000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from public.audit_events),0,'AAL1 admin cannot read audit events');
select throws_ok($$select public.record_audit_event('profile.role.changed','profile','ae000000-0000-4000-8000-000000000005','fixture',null,null,null,null,null)$$,'P0001',null,'AAL1 admin cannot record platform audit events');

reset role;
select set_config('faden.audit_maintenance','on',true);
select public.append_audit_event(
  p_action := 'test.fixture',
  p_entity_type := 'profile',
  p_entity_id := 'ae000000-0000-4000-8000-000000000005',
  p_actor_id := 'ae000000-0000-4000-8000-000000000004',
  p_actor_role := 'admin',
  p_before_json := '{"role":"customer"}'::jsonb,
  p_after_json := '{"role":"customer"}'::jsonb,
  p_request_id := 'req-fixture-001',
  p_ip_hash := repeat('a',64),
  p_user_agent_summary := 'chrome/macos'
);
select set_config('faden.audit_maintenance','off',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ae000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select ok((select count(*)::integer from public.audit_events) >= 1,'AAL2 admin can read audit events');
select throws_ok($$insert into public.audit_events(action,entity_type) values('test.direct','profile')$$,'42501',null,'AAL2 admin cannot insert audit events directly');
select throws_ok($$update public.audit_events set action='changed' where action='test.fixture'$$,'42501',null,'AAL2 admin cannot update audit events');
select throws_ok($$delete from public.audit_events where action='test.fixture'$$,'42501',null,'AAL2 admin cannot delete audit events');
select throws_ok($$select public.record_audit_event('made.up.action','profile','ae000000-0000-4000-8000-000000000005','fixture',null,null,null,null,null)$$,'P0001',null,'AAL2 admin cannot append unsupported action names');
select lives_ok($$select public.record_audit_event('profile.role.changed','profile','ae000000-0000-4000-8000-000000000005','fixture',null,null,'req-rpc-001',repeat('b',64),'chrome/macos')$$,'AAL2 admin can append an allowlisted platform event through RPC');

select lives_ok($$select public.admin_set_user_role('ae000000-0000-4000-8000-000000000005','boutique_staff','Audit fixture role change')$$,'trusted admin role RPC appends audit row');
select ok(
  exists(
    select 1 from public.audit_events
    where action='profile.role.changed'
      and entity_id='ae000000-0000-4000-8000-000000000005'
      and before_json->>'role'='customer'
      and after_json->>'role'='boutique_staff'
  ),
  'admin role change stores safe before/after json'
);

reset role;
select set_config('faden.audit_maintenance','on',true);
delete from public.audit_events where entity_id='ae000000-0000-4000-8000-000000000005';
update public.profiles set role='customer' where id='ae000000-0000-4000-8000-000000000005';
select set_config('faden.audit_maintenance','off',true);

select * from finish();
rollback;
