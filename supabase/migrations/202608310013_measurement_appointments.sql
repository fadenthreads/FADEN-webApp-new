-- Staging appointment reservations; no external meeting, reminder or fulfilment action.
create table public.appointment_slots (
 id uuid primary key,
 boutique_id uuid not null references public.boutiques(id),
 owner_id uuid not null references public.profiles(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 kind text not null check(kind in ('video','boutique')),
 location text not null default '' check(length(location)<=500),
 state text not null default 'open' check(state in ('open','booked','withdrawn')),
 check(ends_at-starts_at between interval '15 minutes' and interval '2 hours'),
 check((kind='video' and location='') or (kind='boutique' and length(btrim(location))>=10))
);
create index appointment_slots_owner_time on public.appointment_slots(owner_id,starts_at);
create table public.measurement_appointments (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 slot_id uuid not null references public.appointment_slots(id),
 customer_id uuid not null references public.profiles(id),
 owner_id uuid not null references public.profiles(id),
 boutique_id uuid not null references public.boutiques(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 kind text not null,
 location text not null,
 mode text not null default 'preview' check(mode='preview'),
 status text not null default 'confirmed' check(status in ('confirmed','cancelled','rescheduled')),
 previous_id uuid references public.measurement_appointments(id),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz
);
create unique index appointment_one_per_slot on public.measurement_appointments(slot_id) where status='confirmed';
create unique index appointment_one_per_order on public.measurement_appointments(order_id) where status='confirmed';
create index appointment_customer_time on public.measurement_appointments(customer_id,starts_at);
alter table public.appointment_slots enable row level security;
alter table public.measurement_appointments enable row level security;
revoke all on public.appointment_slots,public.measurement_appointments from anon,authenticated;
grant select on public.appointment_slots,public.measurement_appointments to authenticated;
grant all on public.appointment_slots,public.measurement_appointments to service_role;
create policy appointment_private_read on public.measurement_appointments for select to authenticated using(
 customer_id=auth.uid() or (owner_id=auth.uid() and public.owns_verified_atelier(boutique_id))
);
create policy appointment_slot_read on public.appointment_slots for select to authenticated using(
 (owner_id=auth.uid() and public.owns_verified_atelier(boutique_id)) or
 exists(select 1 from public.measurement_appointments a where a.slot_id=appointment_slots.id and a.customer_id=auth.uid()) or
 (state='open' and exists(select 1 from public.boutiques b where b.id=appointment_slots.boutique_id and b.owner_id=appointment_slots.owner_id and b.status='verified' and b.is_published) and exists(select 1 from public.customer_orders o where o.customer_id=auth.uid() and o.boutique_id=appointment_slots.boutique_id and o.boutique_owner_id=appointment_slots.owner_id and o.status<>'cancelled'))
);

create function public.create_appointment_slot(slot_id uuid,target_boutique uuid,starts timestamptz,ends timestamptz,session_kind text,session_location text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.appointment_slots;
begin
 if not public.owns_verified_atelier(target_boutique) then raise exception 'Boutique not available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1313));
 select * into s from public.appointment_slots where id=slot_id;
 if found then
 if s.owner_id=auth.uid() and s.boutique_id=target_boutique and s.starts_at=starts and s.ends_at=ends and s.kind=session_kind and s.location=btrim(session_location) then return s.id; end if;
 raise exception 'Submission reference already used'; end if;
 if slot_id is null or starts is null or ends is null or starts<now()+interval '15 minutes' or starts>now()+interval '90 days'
 or ends-starts not between interval '15 minutes' and interval '2 hours' or session_kind is null or session_kind not in ('video','boutique')
 or session_location is null or length(session_location)>500 or (session_kind='video' and session_location<>'') or (session_kind='boutique' and length(btrim(session_location))<10)
 then raise exception 'Choose a future 15–120 minute session within 90 days and provide its location'; end if;
 if exists(select 1 from public.appointment_slots where owner_id=auth.uid() and state<>'withdrawn' and starts_at<ends and ends_at>starts) then raise exception 'This time overlaps another slot in your schedule'; end if;
 if (select count(*) from public.appointment_slots where owner_id=auth.uid() and starts_at>now() and state<>'withdrawn')>=100 then raise exception 'Availability limit reached'; end if;
 insert into public.appointment_slots(id,boutique_id,owner_id,starts_at,ends_at,kind,location) values(slot_id,target_boutique,auth.uid(),starts,ends,session_kind,btrim(session_location));
 return slot_id;
end; $$;

create function public.reserve_measurement_appointment(target_order uuid,target_slot uuid,command_id uuid,replacing uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; s public.appointment_slots; old public.measurement_appointments; retry public.measurement_appointments;
begin
 if confirmed is distinct from true or command_id is null then raise exception 'Confirm your preview appointment'; end if;
 -- Serializes the customer's bookings across multiple boutiques/orders.
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(o.boutique_owner_id::text,1313));
 select * into retry from public.measurement_appointments where id=command_id;
 if found then
 if retry.order_id=o.id and retry.slot_id=target_slot and retry.previous_id is not distinct from replacing then return retry.id; end if;
 raise exception 'Submission reference already used'; end if;
 select * into s from public.appointment_slots where id=target_slot for update;
 if not found or s.boutique_id<>o.boutique_id or s.owner_id<>o.boutique_owner_id or s.state<>'open' or s.starts_at<now()+interval '5 minutes'
 or not exists(select 1 from public.boutiques b where b.id=s.boutique_id and b.owner_id=s.owner_id and b.status='verified' and b.is_published) then raise exception 'This slot is no longer available'; end if;
 select * into old from public.measurement_appointments where order_id=o.id and status='confirmed' for update;
 if (old.id is null and replacing is not null) or (old.id is not null and old.id is distinct from replacing) then raise exception 'Your appointment changed; reload before booking'; end if;
 if old.id is not null and old.starts_at<=now() then raise exception 'Past appointments cannot be rescheduled'; end if;
 if exists(select 1 from public.measurement_appointments a where a.customer_id=auth.uid() and a.status='confirmed' and a.id is distinct from old.id and a.starts_at<s.ends_at and a.ends_at>s.starts_at) then raise exception 'You already have an appointment at this time'; end if;
 if (select count(*) from public.measurement_appointments where order_id=o.id)>=50 then raise exception 'Appointment history limit reached'; end if;
 if old.id is not null then
 update public.measurement_appointments set status='rescheduled',cancelled_at=now() where id=old.id;
 update public.appointment_slots set state='open' where id=old.slot_id;
 end if;
 update public.appointment_slots set state='booked' where id=s.id;
 insert into public.measurement_appointments(id,order_id,slot_id,customer_id,owner_id,boutique_id,starts_at,ends_at,kind,location,previous_id)
 values(command_id,o.id,s.id,auth.uid(),s.owner_id,s.boutique_id,s.starts_at,s.ends_at,s.kind,s.location,replacing);
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'appointment.reserved','measurement_appointment',command_id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('appointment.preview_reserved','measurement_appointment',command_id::text,jsonb_build_object('appointment_id',command_id));
 return command_id;
end; $$;

create function public.cancel_measurement_appointment(target_appointment uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.measurement_appointments;
begin
 if confirmed is distinct from true then raise exception 'Confirm cancellation'; end if;
 select * into a from public.measurement_appointments where id=target_appointment;
 if not found or not(a.customer_id=auth.uid() or (a.owner_id=auth.uid() and public.owns_verified_atelier(a.boutique_id))) then raise exception 'Appointment not available'; end if;
 perform 1 from public.profiles where id=a.customer_id for update;
 perform 1 from public.customer_orders where id=a.order_id for update;
 perform pg_advisory_xact_lock(hashtextextended(a.owner_id::text,1313));
 select * into a from public.measurement_appointments where id=target_appointment for update;
 if a.status='cancelled' then return a.id; end if;
 if a.status<>'confirmed' or a.starts_at<=now() then raise exception 'This appointment cannot be cancelled; reload your current appointment'; end if;
 update public.measurement_appointments set status='cancelled',cancelled_at=now() where id=a.id;
 update public.appointment_slots set state='open' where id=a.slot_id;
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'appointment.cancelled','measurement_appointment',a.id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('appointment.preview_cancelled','measurement_appointment',a.id::text,jsonb_build_object('appointment_id',a.id));
 return a.id;
end; $$;

create function public.withdraw_appointment_slot(target_slot uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.appointment_slots;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1313));
 select * into s from public.appointment_slots where id=target_slot and owner_id=auth.uid() for update;
 if not found or not public.owns_verified_atelier(s.boutique_id) then raise exception 'Slot not available'; end if;
 if s.state='booked' then raise exception 'Cancel the appointment before withdrawing its slot'; end if;
 update public.appointment_slots set state='withdrawn' where id=s.id;return s.id;
end; $$;

create function public.cancel_order_appointments() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.measurement_appointments;
begin
 if new.status='cancelled' and old.status is distinct from new.status then
 for a in update public.measurement_appointments set status='cancelled',cancelled_at=now() where order_id=new.id and status='confirmed' and starts_at>now() returning * loop
 update public.appointment_slots set state='open' where id=a.slot_id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('appointment.preview_cancelled','measurement_appointment',a.id::text,jsonb_build_object('appointment_id',a.id));
 end loop;
 end if;return new;
end; $$;
create trigger order_cancel_appointments after update of status on public.customer_orders for each row execute function public.cancel_order_appointments();
revoke all on function public.cancel_order_appointments() from public,anon,authenticated;
revoke all on function public.create_appointment_slot(uuid,uuid,timestamptz,timestamptz,text,text),public.reserve_measurement_appointment(uuid,uuid,uuid,uuid,boolean),public.cancel_measurement_appointment(uuid,boolean),public.withdraw_appointment_slot(uuid) from public,anon;
grant execute on function public.create_appointment_slot(uuid,uuid,timestamptz,timestamptz,text,text),public.reserve_measurement_appointment(uuid,uuid,uuid,uuid,boolean),public.cancel_measurement_appointment(uuid,boolean),public.withdraw_appointment_slot(uuid) to authenticated;
notify pgrst,'reload schema';
