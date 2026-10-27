-- Registration creates pending_verification boutiques. They must be able to
-- start verification without an administrator changing their status first.
create or replace function public.owner_create_verification_draft(
  p_boutique_id uuid, p_details jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_boutique record;
  v_submission_id uuid;
  v_event_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id, owner_id, status into v_boutique
    from public.boutiques where id = p_boutique_id for update;
  if not found then raise exception 'Boutique not found'; end if;
  if v_boutique.owner_id != auth.uid() then
    raise exception 'Only the boutique owner can create verification drafts';
  end if;
  if v_boutique.status not in ('draft', 'rejected', 'pending_verification') then
    -- Preserve the existing error contract for callers and applied SQL tests.
    raise exception 'Verification draft can only be created for draft or rejected boutiques';
  end if;
  if exists (select 1 from public.boutique_verification_submissions
    where boutique_id = p_boutique_id and status = 'draft') then
    raise exception 'A draft verification already exists for this boutique';
  end if;
  if exists (select 1 from public.boutique_verification_submissions
    where boutique_id = p_boutique_id and status in ('submitted', 'changes_requested')) then
    raise exception 'An active verification already exists for this boutique';
  end if;
  if not (
    p_details ? 'legal_business_name' and p_details ? 'business_type' and
    p_details ? 'registration_number' and p_details ? 'pan' and
    p_details ? 'registered_address_line1' and p_details ? 'city' and
    p_details ? 'state' and p_details ? 'postal_code' and
    p_details ? 'authorized_rep_name' and p_details ? 'authorized_rep_role' and
    p_details ? 'contact_email' and p_details ? 'contact_phone'
  ) then raise exception 'Missing required verification fields'; end if;
  insert into public.boutique_verification_submissions (
    boutique_id, submitting_owner_id, legal_business_name, public_trading_name,
    business_type, registration_number, gstin, pan, registered_address_line1,
    registered_address_line2, city, state, postal_code, authorized_rep_name,
    authorized_rep_role, contact_email, contact_phone, status
  ) values (
    p_boutique_id, auth.uid(), p_details->>'legal_business_name',
    p_details->>'public_trading_name', p_details->>'business_type',
    p_details->>'registration_number', p_details->>'gstin', p_details->>'pan',
    p_details->>'registered_address_line1', p_details->>'registered_address_line2',
    p_details->>'city', p_details->>'state', p_details->>'postal_code',
    p_details->>'authorized_rep_name', p_details->>'authorized_rep_role',
    p_details->>'contact_email', p_details->>'contact_phone', 'draft'
  ) returning id into v_submission_id;
  insert into public.boutique_verification_events (
    submission_id, boutique_id, event_type, actor_id, actor_role, metadata
  ) values (
    v_submission_id, p_boutique_id, 'draft_created', auth.uid(), 'boutique_owner',
    jsonb_build_object('submission_id', v_submission_id)
  ) returning id into v_event_id;
  return jsonb_build_object('success', true, 'submission_id', v_submission_id, 'event_id', v_event_id);
end;
$$;
comment on function public.owner_create_verification_draft is
'Starts owner verification for a new, draft or rejected boutique. Existing active applications must be resumed.';
