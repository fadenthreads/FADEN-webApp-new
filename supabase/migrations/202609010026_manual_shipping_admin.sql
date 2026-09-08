-- Launch manual fulfilment.  This intentionally does not reuse the disabled
-- Shiprocket tables: an entry here represents a courier arrangement made by an
-- authenticated FADEN administrator outside the application.
create table public.admin_order_fulfilment (
  order_id uuid primary key references public.customer_orders(id) on delete restrict,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manual_order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  carrier_name text not null check (length(btrim(carrier_name)) between 2 and 120),
  tracking_number text not null check (length(btrim(tracking_number)) between 2 and 120),
  tracking_url text check (tracking_url is null or tracking_url ~ '^https://[^[:space:]]+$'),
  status text not null default 'awaiting_arrangement' check (status in ('awaiting_arrangement','booked','picked_up','in_transit','out_for_delivery','delivered','exception','cancelled')),
  admin_note text check (admin_note is null or length(btrim(admin_note)) between 1 and 2000),
  shipped_at timestamptz,
  delivered_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'delivered') or delivered_at is not null)
);

create table public.admin_order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.manual_shipment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  shipment_id uuid not null references public.manual_order_shipments(id) on delete restrict,
  status text not null check (status in ('awaiting_arrangement','booked','picked_up','in_transit','out_for_delivery','delivered','exception','cancelled')),
  carrier_name text not null,
  tracking_number text not null,
  tracking_url text,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.admin_order_address_access_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  admin_id uuid not null references public.profiles(id),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  accessed_at timestamptz not null default now()
);

create index manual_order_shipments_status_idx on public.manual_order_shipments(status, updated_at desc);
create index admin_order_notes_order_idx on public.admin_order_notes(order_id, created_at desc);
create index manual_shipment_events_order_idx on public.manual_shipment_events(order_id, created_at asc);

alter table public.admin_order_fulfilment enable row level security;
alter table public.manual_order_shipments enable row level security;
alter table public.admin_order_notes enable row level security;
alter table public.manual_shipment_events enable row level security;
alter table public.admin_order_address_access_events enable row level security;
revoke all on public.admin_order_fulfilment, public.manual_order_shipments, public.admin_order_notes, public.manual_shipment_events, public.admin_order_address_access_events from anon, authenticated;

create function public.admin_order_captured(p_order_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.order_payment_attempts p where p.order_id=p_order_id and p.status='captured');
$$;

create function public.admin_list_orders(
  p_search text default null, p_queue text default null, p_order_status text default null,
  p_payment_status text default null, p_shipment_status text default null,
  p_cursor timestamptz default null, p_cursor_id uuid default null, p_limit integer default 20
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_limit integer := greatest(1, least(coalesce(p_limit,20),50)); v_more boolean;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if p_queue is not null and p_queue <> 'shipping' then raise exception 'Invalid queue'; end if;
 with rows as (
   select o.id,o.boutique_name,o.status as order_status,o.total_paise,o.currency,o.accepted_at,
     pr.email as customer_email, coalesce(p.status,'unpaid') as payment_status,
     s.status as shipment_status, f.claimed_by, f.version as fulfilment_version,
     public.admin_order_captured(o.id) as captured
   from public.customer_orders o join public.profiles pr on pr.id=o.customer_id
   left join public.order_payment_attempts p on p.order_id=o.id
   left join public.manual_order_shipments s on s.order_id=o.id
   left join public.admin_order_fulfilment f on f.order_id=o.id
   where (p_search is null or o.id::text ilike '%'||left(trim(p_search),120)||'%' or pr.email ilike '%'||left(trim(p_search),120)||'%' or o.boutique_name ilike '%'||left(trim(p_search),120)||'%')
     and (p_queue is distinct from 'shipping' or public.admin_order_captured(o.id))
     and (p_order_status is null or o.status=p_order_status)
     and (p_payment_status is null or coalesce(p.status,'unpaid')=p_payment_status)
     and (p_shipment_status is null or coalesce(s.status,'awaiting_arrangement')=p_shipment_status)
     and (p_cursor is null or (o.accepted_at,o.id) < (p_cursor,coalesce(p_cursor_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by o.accepted_at desc,o.id desc limit v_limit+1
 ), page as (select * from rows limit v_limit)
 select coalesce(jsonb_agg(to_jsonb(page) order by accepted_at desc,id desc),'[]'::jsonb), (select count(*) > v_limit from rows) into v_rows,v_more from page;
 return jsonb_build_object('orders',v_rows,'has_more',coalesce(v_more,false),'next_cursor',case when coalesce(v_more,false) then (select accepted_at from page order by accepted_at,id limit 1) end,'next_cursor_id',case when coalesce(v_more,false) then (select id from page order by accepted_at,id limit 1) end);
end; $$;

create function public.admin_read_order_detail(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if not exists(select 1 from public.customer_orders where id=p_order_id) then raise exception 'Order not found'; end if;
 select jsonb_build_object(
   'order',(select to_jsonb(o) - 'customer_id' - 'boutique_owner_id' from public.customer_orders o where o.id=p_order_id),
   'customer',(select jsonb_build_object('email',p.email,'display_name',p.display_name) from public.customer_orders o join public.profiles p on p.id=o.customer_id where o.id=p_order_id),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'amount_paise',amount_paise,'currency',currency,'status',status,'mode',mode,'created_at',created_at,'verified_at',verified_at)) from public.order_payment_attempts where order_id=p_order_id),'[]'::jsonb),
   'shipment',(select jsonb_build_object('id',id,'carrier_name',carrier_name,'tracking_number',tracking_number,'tracking_url',tracking_url,'status',status,'admin_note',admin_note,'shipped_at',shipped_at,'delivered_at',delivered_at,'version',version,'updated_at',updated_at) from public.manual_order_shipments where order_id=p_order_id),
   'fulfilment',(select jsonb_build_object('claimed_by',claimed_by,'claimed_at',claimed_at,'version',version) from public.admin_order_fulfilment where order_id=p_order_id),
   'notes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by created_at desc) from public.admin_order_notes where order_id=p_order_id),'[]'::jsonb),
   'production',coalesce((select jsonb_agg(jsonb_build_object('stage',stage,'note',note,'created_at',created_at) order by sequence) from public.order_production_updates where order_id=p_order_id),'[]'::jsonb),
   'design_reviews',coalesce((select jsonb_agg(jsonb_build_object('status',status,'title',title,'created_at',created_at,'reviewed_at',reviewed_at) order by revision) from public.order_design_reviews where order_id=p_order_id),'[]'::jsonb),
   'appointments',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'status',status,'starts_at',starts_at,'ends_at',ends_at) order by starts_at desc) from public.measurement_appointments where order_id=p_order_id),'[]'::jsonb),
   'address_available',exists(select 1 from public.order_delivery_details where order_id=p_order_id),
   'timeline',coalesce((select jsonb_agg(jsonb_build_object('status',status,'created_at',created_at) order by created_at) from public.manual_shipment_events where order_id=p_order_id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;

create function public.admin_reveal_order_address(p_order_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_address jsonb;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'An address access reason is required'; end if;
 select address into v_address from public.order_delivery_details where order_id=p_order_id;
 if v_address is null then raise exception 'No delivery address is available'; end if;
 insert into public.admin_order_address_access_events(order_id,admin_id,reason) values(p_order_id,auth.uid(),btrim(p_reason));
 perform public.append_audit_event('admin.order_address_revealed','customer_order',p_order_id::text,auth.uid(),null,btrim(p_reason),null,null,null,null,null,jsonb_build_object('order_id',p_order_id));
 return v_address;
end; $$;

create function public.admin_claim_order_fulfilment(p_order_id uuid,p_expected_version integer,p_claim boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.admin_order_fulfilment;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if not exists(select 1 from public.customer_orders where id=p_order_id) then raise exception 'Order not found'; end if;
 insert into public.admin_order_fulfilment(order_id) values(p_order_id) on conflict(order_id) do nothing;
 select * into v from public.admin_order_fulfilment where order_id=p_order_id for update;
 if p_expected_version is not null and v.version<>p_expected_version then raise exception 'Fulfilment assignment changed; reload'; end if;
 if p_claim then update public.admin_order_fulfilment set claimed_by=auth.uid(),claimed_at=now(),version=version+1,updated_at=now() where order_id=p_order_id returning * into v;
 else update public.admin_order_fulfilment set claimed_by=null,claimed_at=null,version=version+1,updated_at=now() where order_id=p_order_id returning * into v; end if;
 perform public.append_audit_event(case when p_claim then 'admin.fulfilment_claimed' else 'admin.fulfilment_unclaimed' end,'customer_order',p_order_id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('order_id',p_order_id));
 return jsonb_build_object('claimed_by',v.claimed_by,'claimed_at',v.claimed_at,'version',v.version);
end; $$;

create function public.admin_add_order_note(p_order_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if not exists(select 1 from public.customer_orders where id=p_order_id) or length(btrim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid private note'; end if;
 insert into public.admin_order_notes(order_id,author_id,body) values(p_order_id,auth.uid(),btrim(p_body)) returning id into v_id;
 perform public.append_audit_event('admin.order_note_added','customer_order',p_order_id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('order_id',p_order_id));
 return v_id;
end; $$;

create function public.admin_upsert_manual_shipment(p_order_id uuid,p_expected_version integer,p_carrier_name text,p_tracking_number text,p_tracking_url text,p_status text,p_admin_note text,p_confirm_delivered boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.manual_order_shipments; old_status text;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if not public.admin_order_captured(p_order_id) then raise exception 'A confirmed captured payment is required before shipping'; end if;
 if length(btrim(coalesce(p_carrier_name,''))) not between 2 and 120 or length(btrim(coalesce(p_tracking_number,''))) not between 2 and 120 or p_status not in ('awaiting_arrangement','booked','picked_up','in_transit','out_for_delivery','delivered','exception','cancelled') or (p_tracking_url is not null and p_tracking_url !~ '^https://[^[:space:]]+$') or length(coalesce(p_admin_note,''))>2000 then raise exception 'Invalid shipment details'; end if;
 select * into v from public.manual_order_shipments where order_id=p_order_id for update;
 if found then
   if v.version<>p_expected_version then raise exception 'Shipment changed; reload'; end if; old_status:=v.status;
   if (old_status='awaiting_arrangement' and p_status not in ('awaiting_arrangement','booked','cancelled')) or (old_status='booked' and p_status not in ('booked','picked_up','exception','cancelled')) or (old_status='picked_up' and p_status not in ('picked_up','in_transit','exception')) or (old_status='in_transit' and p_status not in ('in_transit','out_for_delivery','exception')) or (old_status='out_for_delivery' and p_status not in ('out_for_delivery','delivered','exception')) or (old_status in ('delivered','cancelled')) then raise exception 'Invalid shipment transition'; end if;
   if p_status='delivered' and p_confirm_delivered is distinct from true then raise exception 'Confirm delivery before marking it delivered'; end if;
   update public.manual_order_shipments set carrier_name=btrim(p_carrier_name),tracking_number=btrim(p_tracking_number),tracking_url=nullif(btrim(p_tracking_url),''),status=p_status,admin_note=nullif(btrim(p_admin_note),''),shipped_at=case when p_status in ('picked_up','in_transit','out_for_delivery','delivered') then coalesce(shipped_at,now()) else shipped_at end,delivered_at=case when p_status='delivered' then now() else null end,version=version+1,updated_by=auth.uid(),updated_at=now() where id=v.id returning * into v;
 else
   if p_expected_version is distinct from 0 then raise exception 'Shipment changed; reload'; end if;
   if p_status='delivered' and p_confirm_delivered is distinct from true then raise exception 'Confirm delivery before marking it delivered'; end if;
   insert into public.manual_order_shipments(order_id,carrier_name,tracking_number,tracking_url,status,admin_note,shipped_at,delivered_at,created_by,updated_by) values(p_order_id,btrim(p_carrier_name),btrim(p_tracking_number),nullif(btrim(p_tracking_url),''),p_status,nullif(btrim(p_admin_note),''),case when p_status in ('picked_up','in_transit','out_for_delivery','delivered') then now() end,case when p_status='delivered' then now() end,auth.uid(),auth.uid()) returning * into v;
 end if;
 insert into public.manual_shipment_events(order_id,shipment_id,status,carrier_name,tracking_number,tracking_url,actor_id) values(p_order_id,v.id,v.status,v.carrier_name,v.tracking_number,v.tracking_url,auth.uid());
 perform public.append_audit_event('admin.manual_shipment_updated','manual_order_shipment',v.id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('order_id',p_order_id,'status',v.status));
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('manual_shipment.updated','customer_order',p_order_id::text,jsonb_build_object('order_id',p_order_id,'shipment_id',v.id,'status',v.status));
 return jsonb_build_object('id',v.id,'status',v.status,'version',v.version,'updated_at',v.updated_at);
end; $$;

-- Safe audience projection; deliberately excludes internal admin_note and actor identity.
create function public.read_order_manual_shipment(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.customer_orders o where o.id=p_order_id and (o.customer_id=auth.uid() or (o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id)))) then raise exception 'Order not found'; end if;
 return jsonb_build_object('shipment',(select jsonb_build_object('carrier_name',carrier_name,'tracking_number',tracking_number,'tracking_url',tracking_url,'status',status,'shipped_at',shipped_at,'delivered_at',delivered_at) from public.manual_order_shipments where order_id=p_order_id),'timeline',coalesce((select jsonb_agg(jsonb_build_object('status',status,'created_at',created_at) order by created_at) from public.manual_shipment_events where order_id=p_order_id),'[]'::jsonb));
end; $$;

revoke all on function public.admin_order_captured(uuid),public.admin_list_orders(text,text,text,text,text,timestamptz,uuid,integer),public.admin_read_order_detail(uuid),public.admin_reveal_order_address(uuid,text),public.admin_claim_order_fulfilment(uuid,integer,boolean),public.admin_add_order_note(uuid,text),public.admin_upsert_manual_shipment(uuid,integer,text,text,text,text,text,boolean),public.read_order_manual_shipment(uuid) from public,anon;
grant execute on function public.admin_list_orders(text,text,text,text,text,timestamptz,uuid,integer),public.admin_read_order_detail(uuid),public.admin_reveal_order_address(uuid,text),public.admin_claim_order_fulfilment(uuid,integer,boolean),public.admin_add_order_note(uuid,text),public.admin_upsert_manual_shipment(uuid,integer,text,text,text,text,text,boolean),public.read_order_manual_shipment(uuid) to authenticated;
notify pgrst,'reload schema';
