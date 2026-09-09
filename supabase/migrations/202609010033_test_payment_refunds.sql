-- Test-mode provider event and refund ledger. Provider identifiers are unique
-- so retries and out-of-order webhooks cannot create a second financial state.
alter table public.order_payment_attempts drop constraint order_payment_attempts_status_check;
alter table public.order_payment_attempts add constraint order_payment_attempts_status_check
  check(status in ('creating','ready','authorized','captured','failed','refund_pending','refunded'));

create table public.payment_provider_events (
  id bigint generated always as identity primary key,
  provider_event_id text not null unique check (provider_event_id ~ '^[A-Za-z0-9_-]{1,160}$'),
  event_type text not null check (event_type in ('payment.captured','payment.authorized','payment.failed','refund.created','refund.processed','refund.failed')),
  provider_order_id text,
  provider_payment_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'received' check(outcome in ('received','ignored','processed','failed'))
);
alter table public.payment_provider_events enable row level security;
revoke all on public.payment_provider_events from public, anon, authenticated;

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  payment_attempt_id uuid not null references public.order_payment_attempts(id) on delete restrict,
  amount_paise bigint not null check(amount_paise > 0),
  reason text not null check(char_length(reason) between 3 and 500),
  status text not null default 'pending' check(status in ('pending','processed','failed')),
  provider_refund_id text unique,
  provider_payment_id text not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_reason text
);
create index payment_refunds_order_idx on public.payment_refunds(order_id, requested_at desc);
alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;

create function public.record_test_provider_event(
  p_event_id text, p_event_type text, p_provider_order_id text default null, p_provider_payment_id text default null
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  insert into public.payment_provider_events(provider_event_id,event_type,provider_order_id,provider_payment_id)
  values(p_event_id,p_event_type,p_provider_order_id,p_provider_payment_id)
  on conflict(provider_event_id) do nothing;
  return found;
end; $$;

create function public.mark_test_provider_event(p_event_id text, p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.payment_provider_events set outcome=p_outcome, processed_at=now()
  where provider_event_id=p_event_id and outcome='received';
end; $$;

create function public.admin_create_test_refund(p_order_id uuid, p_amount_paise bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.order_payment_attempts; total_refunded bigint; refund public.payment_refunds;
begin
  if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
  if p_amount_paise is null or p_amount_paise < 1 then raise exception 'Refund amount is invalid'; end if;
  if p_reason is null or char_length(trim(p_reason)) not between 3 and 500 then raise exception 'Refund reason is required'; end if;
  select * into a from public.order_payment_attempts where order_id=p_order_id for update;
  if not found or a.status not in ('captured','refund_pending','refunded') or a.provider_payment_id is null then raise exception 'Captured payment not found'; end if;
  select coalesce(sum(amount_paise),0) into total_refunded from public.payment_refunds where payment_attempt_id=a.id and status in ('pending','processed');
  if total_refunded + p_amount_paise > a.amount_paise then raise exception 'Refund exceeds captured payment'; end if;
  insert into public.payment_refunds(order_id,payment_attempt_id,amount_paise,reason,provider_payment_id,requested_by)
  values(p_order_id,a.id,p_amount_paise,trim(p_reason),a.provider_payment_id,auth.uid()) returning * into refund;
  update public.order_payment_attempts set status='refund_pending' where id=a.id and status='captured';
  insert into public.audit_events(actor_id,action,entity_type,entity_id,reason,metadata)
  values(auth.uid(),'refund.initiated','payment_refund',refund.id::text,trim(p_reason),jsonb_build_object('order_id',p_order_id,'amount_paise',p_amount_paise));
  insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
  values('payment.refund_pending','customer_order',p_order_id::text,jsonb_build_object('order_id',p_order_id,'refund_id',refund.id));
  return jsonb_build_object('id',refund.id,'provider_payment_id',a.provider_payment_id,'amount_paise',refund.amount_paise);
end; $$;

create function public.attach_test_refund(p_refund_id uuid, p_provider_refund_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_provider_refund_id is null or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]+$' then raise exception 'Provider refund mismatch'; end if;
  update public.payment_refunds set provider_refund_id=p_provider_refund_id
  where id=p_refund_id and status='pending' and provider_refund_id is null;
  if not found then raise exception 'Refund cannot be attached'; end if;
end; $$;

create function public.record_test_refund_outcome(p_provider_refund_id text, p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.payment_refunds; a public.order_payment_attempts; refunded bigint;
begin
  select * into r from public.payment_refunds where provider_refund_id=p_provider_refund_id for update;
  if not found then raise exception 'Refund not found'; end if;
  if p_status not in ('processed','failed') then raise exception 'Invalid refund status'; end if;
  if r.status=p_status then return; end if;
  update public.payment_refunds set status=p_status,processed_at=now(),failure_reason=case when p_status='failed' then 'provider refund failed' else null end where id=r.id;
  select * into a from public.order_payment_attempts where id=r.payment_attempt_id for update;
  select coalesce(sum(amount_paise),0) into refunded from public.payment_refunds where payment_attempt_id=a.id and status='processed';
  update public.order_payment_attempts set status=case when refunded >= a.amount_paise then 'refunded' else 'captured' end where id=a.id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
  values(null,case when p_status='processed' then 'refund.completed' else 'refund.failed' end,'payment_refund',r.id::text,jsonb_build_object('order_id',r.order_id,'amount_paise',r.amount_paise));
  insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
  values(case when p_status='processed' then 'payment.refund_completed' else 'payment.refund_failed' end,'customer_order',r.order_id::text,jsonb_build_object('order_id',r.order_id,'refund_id',r.id));
end; $$;

revoke all on function public.record_test_provider_event(text,text,text,text), public.mark_test_provider_event(text,text), public.attach_test_refund(uuid,text), public.record_test_refund_outcome(text,text) from public, anon, authenticated;
grant execute on function public.record_test_provider_event(text,text,text,text), public.mark_test_provider_event(text,text), public.attach_test_refund(uuid,text), public.record_test_refund_outcome(text,text) to service_role;
revoke all on function public.admin_create_test_refund(uuid,bigint,text) from public, anon;
grant execute on function public.admin_create_test_refund(uuid,bigint,text) to authenticated;
notify pgrst, 'reload schema';
