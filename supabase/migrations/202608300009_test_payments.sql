alter table public.customer_orders drop constraint customer_orders_status_check;
alter table public.customer_orders add constraint customer_orders_status_check check(status in ('awaiting_payment','cancelled','test_advance_paid'));
alter table public.customer_orders add column cancelled_at timestamptz;
alter table public.customer_orders add column test_paid_at timestamptz;

create table public.order_payment_attempts (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.customer_orders(id) on delete restrict,
 customer_id uuid not null references public.profiles(id),
 amount_paise bigint not null check(amount_paise>=100),
 currency text not null default 'INR' check(currency='INR'),
 mode text not null default 'test' check(mode='test'),
 key_id text not null check(key_id like 'rzp_test_%'),
 status text not null default 'creating' check(status in ('creating','ready','captured')),
 provider_order_id text unique,
 provider_payment_id text unique,
 created_at timestamptz not null default now(),
 verified_at timestamptz,
 check(status='creating' or provider_order_id is not null),
 check(status<>'captured' or (provider_payment_id is not null and verified_at is not null))
);
create index order_payment_attempts_customer_idx on public.order_payment_attempts(customer_id);
alter table public.order_payment_attempts enable row level security;
revoke all on public.order_payment_attempts from anon,authenticated;
grant select on public.order_payment_attempts to authenticated;
create policy payment_customer_read on public.order_payment_attempts for select to authenticated using(customer_id=auth.uid());

create function public.cancel_unpaid_order(target_order uuid,confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.customer_orders;
begin
 if confirmed is distinct from true then raise exception 'Confirm cancellation first'; end if;
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found then raise exception 'Order not found'; end if;
 if o.status='cancelled' then return o.id; end if;
 if o.status<>'awaiting_payment' then raise exception 'This order cannot be cancelled here'; end if;
 if exists(select 1 from public.order_payment_attempts where order_id=o.id) then raise exception 'Checkout has already started. Payment reconciliation is required before cancellation'; end if;
 update public.customer_orders set status='cancelled',cancelled_at=now() where id=o.id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('order.cancelled','customer_order',o.id::text,jsonb_build_object('order_id',o.id));
 return o.id;
end; $$;
revoke all on function public.cancel_unpaid_order(uuid,boolean) from public,anon;
grant execute on function public.cancel_unpaid_order(uuid,boolean) to authenticated;

-- Only the authenticated application server can reserve or reconcile a gateway attempt.
-- Order locking also serializes cancellation against checkout creation.
create function public.reserve_test_payment(target_order uuid,actor uuid,public_key_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; a public.order_payment_attempts; is_new boolean=false;
begin
 if public_key_id is null or public_key_id not like 'rzp_test_%' then raise exception 'Only test payments are allowed'; end if;
 select * into o from public.customer_orders where id=target_order and customer_id=actor for update;
 if not found or o.status<>'awaiting_payment' then raise exception 'Order is not awaiting payment'; end if;
 if o.advance_paise<100 then raise exception 'Online test checkout requires an advance of at least INR 1'; end if;
 if not exists(select 1 from public.boutiques where id=o.boutique_id and owner_id=o.boutique_owner_id and status='verified' and is_published) then raise exception 'Boutique is not available for checkout'; end if;
 if not exists(select 1 from public.request_shares where id=o.share_id and revoked_at is null) then raise exception 'Request access was revoked; cancel this unpaid order before starting a new request'; end if;
 select * into a from public.order_payment_attempts where order_id=o.id;
 if not found then
   insert into public.order_payment_attempts(order_id,customer_id,amount_paise,key_id) values(o.id,actor,o.advance_paise,public_key_id) returning * into a;
   is_new=true;
 elsif a.key_id<>public_key_id then raise exception 'Payment credentials changed; reconciliation is required';
 end if;
 return to_jsonb(a)||jsonb_build_object('is_new',is_new);
end; $$;
revoke all on function public.reserve_test_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_test_payment(uuid,uuid,text) to service_role;

create function public.attach_test_gateway_order(target_attempt uuid,gateway_order text,amount bigint) returns void language plpgsql security definer set search_path='' as $$
declare a public.order_payment_attempts;
begin
 select * into a from public.order_payment_attempts where id=target_attempt for update;
 if not found or a.amount_paise is distinct from amount or gateway_order is null or gateway_order !~ '^order_[A-Za-z0-9]+$' then raise exception 'Gateway order mismatch'; end if;
 if a.provider_order_id=gateway_order then return; end if;
 if a.status<>'creating' or a.provider_order_id is not null then raise exception 'Gateway order already assigned'; end if;
 update public.order_payment_attempts set provider_order_id=gateway_order,status='ready' where id=a.id;
end; $$;
revoke all on function public.attach_test_gateway_order(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.attach_test_gateway_order(uuid,text,bigint) to service_role;

create function public.record_test_capture(target_attempt uuid,gateway_order text,gateway_payment text,amount bigint,payment_currency text) returns uuid language plpgsql security definer set search_path='' as $$
declare candidate public.order_payment_attempts; a public.order_payment_attempts; o public.customer_orders;
begin
 select * into candidate from public.order_payment_attempts where id=target_attempt;
 if not found then raise exception 'Attempt not found'; end if;
 select * into o from public.customer_orders where id=candidate.order_id for update;
 select * into a from public.order_payment_attempts where id=target_attempt for update;
 if gateway_order is distinct from a.provider_order_id or amount is distinct from a.amount_paise or payment_currency is distinct from 'INR' or gateway_payment is null or gateway_payment !~ '^pay_[A-Za-z0-9]+$' then raise exception 'Verified payment does not match the saved advance'; end if;
 if a.status='captured' then
   if a.provider_payment_id=gateway_payment then return o.id; end if;
   raise exception 'A different payment was already recorded; manual review required';
 end if;
 if o.status<>'awaiting_payment' or a.status<>'ready' then raise exception 'Order cannot receive a payment'; end if;
 update public.order_payment_attempts set status='captured',provider_payment_id=gateway_payment,verified_at=now() where id=a.id;
 update public.customer_orders set status='test_advance_paid',test_paid_at=now() where id=o.id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('payment.test_captured','customer_order',o.id::text,jsonb_build_object('order_id',o.id,'attempt_id',a.id));
 return o.id;
end; $$;
revoke all on function public.record_test_capture(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_test_capture(uuid,text,text,bigint,text) to service_role;
