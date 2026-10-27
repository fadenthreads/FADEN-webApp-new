-- Early-launch policy: an AAL2 Admin may explicitly waive official documents.
-- This approves marketplace participation, not legal/document verification.
-- Existing document-review RPCs remain strict and are not bypassed globally.
create function public.admin_approve_boutique_without_documents(
 p_boutique_id uuid, p_reason text, p_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.boutiques;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if p_confirmed is distinct from true then raise exception 'Confirm approval without official documents'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'Provide an approval reason between 3 and 1000 characters'; end if;
 select * into b from public.boutiques where id=p_boutique_id for update;
 if not found then raise exception 'Boutique not found'; end if;
 if b.status='verified' and exists(select 1 from public.audit_events where entity_type='boutique' and entity_id=b.id::text and action='boutique.approved_without_documents') then
   return jsonb_build_object('success',true,'boutique_id',b.id,'approval_basis','document_waiver');
 end if;
 if b.status not in ('draft','pending_verification') then raise exception 'Only pending or draft boutiques can receive document-free approval'; end if;
 if b.owner_id is null or length(btrim(b.name))<2 or length(btrim(coalesce(b.city,'')))<2 then raise exception 'Owner, boutique name and city are required'; end if;
 update public.boutiques set status='verified',is_published=true,updated_at=now() where id=b.id;
 perform public.append_audit_event(
   p_action=>'boutique.approved_without_documents', p_entity_type=>'boutique',
   p_entity_id=>b.id::text,p_actor_id=>auth.uid(),p_actor_role=>'admin',
   p_reason=>btrim(p_reason),p_after_json=>jsonb_build_object('status','verified','is_published',true,'approval_basis','document_waiver')
 );
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
 values('boutique.approved_without_documents','boutique',b.id::text,jsonb_build_object('boutique_id',b.id,'boutique_name',b.name,'owner_id',b.owner_id,'approval_basis','document_waiver'));
 return jsonb_build_object('success',true,'boutique_id',b.id,'approval_basis','document_waiver');
end; $$;
revoke all on function public.admin_approve_boutique_without_documents(uuid,text,boolean) from public, anon;
grant execute on function public.admin_approve_boutique_without_documents(uuid,text,boolean) to authenticated;
comment on function public.admin_approve_boutique_without_documents is
'Explicit audited early-launch document waiver. Requires AAL2 Admin, reason and confirmation; publishes only the selected pending boutique. Does not approve or fabricate official documents.';
