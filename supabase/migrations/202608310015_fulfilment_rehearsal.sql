-- Private, customer-confirmed but unverified delivery details. No courier actions.
create table public.order_delivery_details (
 order_id uuid primary key references public.customer_orders(id) on delete restrict,
 revision integer not null check(revision between 1 and 100),
 address jsonb not null check(jsonb_typeof(address)='object'),
 verification text not null default 'unverified' check(verification='unverified'),
 mode text not null default 'rehearsal' check(mode='rehearsal'),
 confirmed_at timestamptz not null default now(),
 last_command_id uuid not null,
 unique(order_id,revision)
);
create table public.order_shipment_events (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 address_revision integer not null,
 sequence integer not null check(sequence between 1 and 30),
 stage integer not null check(stage between 1 and 5),
 note text not null check(length(btrim(note)) between 10 and 1000),
 mode text not null default 'rehearsal' check(mode='rehearsal'),
 created_at timestamptz not null default now(),
 unique(order_id,sequence),
 foreign key(order_id,address_revision) references public.order_delivery_details(order_id,revision)
);
create table public.order_delivery_confirmations (
 order_id uuid primary key references public.customer_orders(id) on delete restrict,
 shipment_event_id uuid not null references public.order_shipment_events(id),
 customer_id uuid not null references public.profiles(id),
 mode text not null default 'rehearsal' check(mode='rehearsal'),
 confirmed_at timestamptz not null default now()
);
alter table public.order_delivery_details enable row level security;
alter table public.order_shipment_events enable row level security;
alter table public.order_delivery_confirmations enable row level security;
revoke all on public.order_delivery_details,public.order_shipment_events,public.order_delivery_confirmations from anon,authenticated;
grant select on public.order_delivery_details,public.order_shipment_events,public.order_delivery_confirmations to authenticated;
grant all on public.order_delivery_details,public.order_shipment_events,public.order_delivery_confirmations to service_role;
create policy delivery_details_private on public.order_delivery_details for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id));
create policy shipment_events_private on public.order_shipment_events for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id));
create policy delivery_confirmation_private on public.order_delivery_confirmations for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id));

create function public.save_order_delivery_details(target_order uuid,expected_revision integer,details jsonb,command_id uuid,confirmed boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; a public.order_delivery_details; k text;
begin
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm sharing delivery details with your order boutique'; end if;
 if command_id is null or expected_revision is null or expected_revision not between 0 and 99 or details is null or jsonb_typeof(details)<>'object' then raise exception 'Provide valid delivery details'; end if;
 if (select count(*) from jsonb_object_keys(details))<>8 then raise exception 'Provide only the required delivery fields'; end if;
 foreach k in array array['recipient','phone','line1','line2','city','state','postal_code','country'] loop
   if jsonb_typeof(details->k) is distinct from 'string' or length(details->>k)>200 then raise exception 'Invalid delivery field'; end if;
 end loop;
 if length(btrim(details->>'recipient')) not between 2 and 100 or length(btrim(details->>'line1'))<5
 or length(btrim(details->>'city'))<2 or length(btrim(details->>'state'))<2
 or (details->>'phone') !~ '^\+91[6-9][0-9]{9}$' or (details->>'postal_code') !~ '^[1-9][0-9]{5}$' or details->>'country'<>'IN'
 then raise exception 'Enter a recipient, full Indian address, six-digit PIN and +91 mobile number'; end if;
 select * into a from public.order_delivery_details where order_id=o.id;
 if a.last_command_id=command_id and a.revision=expected_revision+1 and a.address=details then return a.revision; end if;
 if a.last_command_id=command_id then raise exception 'Submission reference already used'; end if;
 if coalesce(a.revision,0)<>expected_revision then raise exception 'Address changed; reload before saving'; end if;
 if exists(select 1 from public.order_shipment_events where order_id=o.id) then raise exception 'Address is locked after packing rehearsal; contact support for corrections'; end if;
 insert into public.order_delivery_details(order_id,revision,address,last_command_id)
 values(o.id,expected_revision+1,details,command_id)
 on conflict(order_id) do update set revision=excluded.revision,address=excluded.address,last_command_id=excluded.last_command_id,confirmed_at=now();
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'delivery.address_confirmed','order',o.id::text);
 return expected_revision+1;
end; $$;

create function public.record_shipment_rehearsal(target_order uuid,expected_sequence integer,target_stage integer,progress_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; previous public.order_shipment_events; retry public.order_shipment_events; address_version integer;
begin
 select * into o from public.customer_orders where id=target_order and boutique_owner_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 perform 1 from public.boutiques where id=o.boutique_id and owner_id=auth.uid() and status='verified' and is_published for share;
 if not found then raise exception 'Order not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this is shipment rehearsal, not real fulfilment'; end if;
 if command_id is null or expected_sequence is null or expected_sequence not between 0 and 29 or target_stage is null or target_stage not between 1 and 5
 or progress_note is null or length(btrim(progress_note)) not between 10 and 1000 then raise exception 'Provide a valid milestone and 10–1000 character note'; end if;
 select * into retry from public.order_shipment_events where id=command_id;
 if found then
 if retry.order_id=o.id and retry.sequence=expected_sequence+1 and retry.stage=target_stage and retry.note=btrim(progress_note) then return retry.id; end if;
 raise exception 'Submission reference already used'; end if;
 if exists(select 1 from public.order_delivery_confirmations where order_id=o.id) then raise exception 'The delivery rehearsal is already confirmed'; end if;
 if (select status from public.order_design_reviews where order_id=o.id order by revision desc limit 1) is distinct from 'approved'
 or (select stage from public.order_production_updates where order_id=o.id order by sequence desc limit 1) is distinct from 5
 then raise exception 'Approved design and ready-for-fitting production rehearsal are required'; end if;
 select revision into address_version from public.order_delivery_details where order_id=o.id;
 if not found then raise exception 'The customer must confirm delivery details first'; end if;
 select * into previous from public.order_shipment_events where order_id=o.id order by sequence desc limit 1;
 if coalesce(previous.sequence,0)<>expected_sequence then raise exception 'Shipment history changed; reload before updating'; end if;
 if (previous.id is null and target_stage<>1) or (previous.id is not null and target_stage not between previous.stage and least(previous.stage+1,5))
 then raise exception 'Record the current or next milestone; do not skip or reverse stages'; end if;
 insert into public.order_shipment_events(id,order_id,address_revision,sequence,stage,note) values(command_id,o.id,address_version,expected_sequence+1,target_stage,btrim(progress_note));
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'shipment.rehearsed','shipment_event',command_id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('shipment.rehearsed','shipment_event',command_id::text,jsonb_build_object('order_id',o.id,'event_id',command_id));
 return command_id;
end; $$;

create function public.confirm_delivery_rehearsal(target_order uuid,expected_event uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; e public.order_shipment_events; receipt public.order_delivery_confirmations;
begin
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 if confirmed is distinct from true or expected_event is null then raise exception 'Confirm this is only a delivery rehearsal'; end if;
 select * into e from public.order_shipment_events where order_id=o.id order by sequence desc limit 1;
 if not found or e.stage<>5 or e.id<>expected_event then raise exception 'Wait for the delivered rehearsal milestone and reload'; end if;
 select * into receipt from public.order_delivery_confirmations where order_id=o.id;
 if found then return receipt.shipment_event_id; end if;
 insert into public.order_delivery_confirmations(order_id,shipment_event_id,customer_id) values(o.id,e.id,auth.uid());
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'delivery.rehearsal_confirmed','order',o.id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('delivery.rehearsal_confirmed','order',o.id::text,jsonb_build_object('order_id',o.id));
 return e.id;
end; $$;
revoke all on function public.save_order_delivery_details(uuid,integer,jsonb,uuid,boolean),public.record_shipment_rehearsal(uuid,integer,integer,text,uuid,boolean),public.confirm_delivery_rehearsal(uuid,uuid,boolean) from public,anon;
grant execute on function public.save_order_delivery_details(uuid,integer,jsonb,uuid,boolean),public.record_shipment_rehearsal(uuid,integer,integer,text,uuid,boolean),public.confirm_delivery_rehearsal(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
