-- A02 Admin Overview: single security-definer RPC for platform metrics.
-- Requires authenticated admin with AAL2.

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gmv_paise bigint;
  v_active_orders_count integer;
  v_pending_verification_count integer;
  v_open_disputes_count integer;
  v_settlements_awaiting_count integer;
  v_recent_activity jsonb;
  v_thirty_days_ago timestamptz;
begin
  -- Authorization: require authenticated admin with AAL2
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Define time range explicitly (30 days)
  v_thirty_days_ago := now() - interval '30 days';

  -- Calculate gross marketplace value using captured payments only
  -- Money is stored as integer paise
  select coalesce(sum(amount_paise), 0)
  into v_gmv_paise
  from public.order_payment_attempts
  where status = 'captured'
    and verified_at >= v_thirty_days_ago;

  -- Count active orders (not cancelled)
  select count(*)::integer
  into v_active_orders_count
  from public.customer_orders
  where status in ('awaiting_payment', 'test_advance_paid');

  -- Count pending boutique verifications
  select count(*)::integer
  into v_pending_verification_count
  from public.boutiques
  where status = 'pending_verification';

  -- Count open disputes
  -- Note: disputes table doesn't exist yet, will return 0
  v_open_disputes_count := 0;

  -- Count settlements awaiting action
  -- Note: settlements table doesn't exist yet, will return 0
  v_settlements_awaiting_count := 0;

  -- Get recent auditable platform activity (last 10 events)
  -- Return safe subset: timestamp, action, entity_type, entity_id, actor_id, reason
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ae.id,
        'created_at', ae.created_at,
        'action', ae.action,
        'entity_type', ae.entity_type,
        'entity_id', ae.entity_id,
        'actor_id', ae.actor_id,
        'reason', ae.reason
      ) order by ae.created_at desc, ae.id desc
    ),
    '[]'::jsonb
  )
  into v_recent_activity
  from (
    select id, created_at, action, entity_type, entity_id, actor_id, reason
    from public.audit_events
    order by created_at desc, id desc
    limit 10
  ) ae;

  -- Return aggregated summary
  return jsonb_build_object(
    'time_range_days', 30,
    'generated_at', now(),
    'gmv_paise', v_gmv_paise,
    'active_orders_count', v_active_orders_count,
    'pending_verification_count', v_pending_verification_count,
    'open_disputes_count', v_open_disputes_count,
    'settlements_awaiting_count', v_settlements_awaiting_count,
    'recent_activity', v_recent_activity
  );
end;
$$;

-- Revoke all permissions from public, anonymous, and authenticated roles
revoke all on function public.admin_dashboard_summary() from public, anon, authenticated;

-- Grant execute only to authenticated (RPC will enforce AAL2 internally)
grant execute on function public.admin_dashboard_summary() to authenticated;

comment on function public.admin_dashboard_summary() is
'Returns platform metrics and recent activity for AAL2 admin dashboard. All monetary values in integer paise.';

notify pgrst, 'reload schema';
