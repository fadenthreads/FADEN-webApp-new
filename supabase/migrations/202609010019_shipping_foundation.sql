-- Provider-neutral live shipping foundation. No provider calls or live bookings are enabled.
create table public.order_shipments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.customer_orders(id) on delete restrict,
 address_revision integer not null,
 provider text not null check(provider in ('shiprocket')),
 provider_order_id text,
 provider_shipment_id text,
 awb_code text unique,
 courier_id text,
 courier_name text,
 status text not null default 'draft' check(status in ('draft','booking','ready_to_ship','pickup_scheduled','in_transit','out_for_delivery','delivered','exception','rto','cancelled')),
 tracking_url text,
 label_url text,
 manifest_url text,
 booked_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 foreign key(order_id,address_revision) references public.order_delivery_details(order_id,revision),
 check((status in ('draft','booking')) or (provider_order_id is not null and provider_shipment_id is not null))
);

create table public.shipping_commands (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 operation text not null check(operation in ('create_order','assign_awb','schedule_pickup','cancel','refresh_tracking','generate_label','generate_manifest')),
 request_key text not null,
 status text not null default 'pending' check(status in ('pending','completed','failed','unknown')),
 provider_reference text,
 attempts integer not null default 0 check(attempts between 0 and 20),
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(order_id,operation,request_key)
);

create table public.shipment_tracking_events (
 id bigint generated always as identity primary key,
 shipment_id uuid not null references public.order_shipments(id) on delete restrict,
 provider_event_id text not null,
 status text not null check(status in ('ready_to_ship','pickup_scheduled','in_transit','out_for_delivery','delivered','exception','rto','cancelled','unknown')),
 label text not null check(length(btrim(label)) between 1 and 200),
 location text check(location is null or length(location) <= 200),
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 unique(shipment_id,provider_event_id)
);

create index order_shipments_status_idx on public.order_shipments(status,updated_at desc);
create index shipping_commands_retry_idx on public.shipping_commands(status,updated_at) where status in ('pending','failed','unknown');
create index shipment_tracking_timeline_idx on public.shipment_tracking_events(shipment_id,occurred_at desc);

alter table public.order_shipments enable row level security;
alter table public.shipping_commands enable row level security;
alter table public.shipment_tracking_events enable row level security;
revoke all on public.order_shipments,public.shipping_commands,public.shipment_tracking_events from anon,authenticated;
grant select on public.order_shipments,public.shipment_tracking_events to authenticated;
grant all on public.order_shipments,public.shipping_commands,public.shipment_tracking_events to service_role;

create policy order_shipments_private on public.order_shipments for select to authenticated
using(exists(select 1 from public.customer_orders o where o.id=order_id));
create policy shipment_tracking_private on public.shipment_tracking_events for select to authenticated
using(exists(select 1 from public.order_shipments s join public.customer_orders o on o.id=s.order_id where s.id=shipment_id));

create trigger order_shipments_set_updated_at before update on public.order_shipments
for each row execute function public.set_updated_at();
create trigger shipping_commands_set_updated_at before update on public.shipping_commands
for each row execute function public.set_updated_at();

notify pgrst,'reload schema';
