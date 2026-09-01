-- Preview outcomes only. No meetings, measurements, payments or messages are triggered.
alter table public.measurement_appointments
 drop constraint measurement_appointments_status_check,
 add constraint measurement_appointments_status_check check(status in ('confirmed','cancelled','rescheduled','completed','no_show')),
 add column outcome_at timestamptz,
 add column outcome_by uuid references public.profiles(id),
 add column follow_up_of uuid references public.measurement_appointments(id),
 add constraint appointment_outcome_consistent check(
   (status in ('completed','no_show') and outcome_at is not null and outcome_by is not null)
   or (status not in ('completed','no_show') and outcome_at is null and outcome_by is null)),
 add constraint appointment_follow_up_not_self check(follow_up_of is distinct from id);
create index appointment_owner_pending_outcome on public.measurement_appointments(owner_id,ends_at) where status='confirmed';

-- The reservation RPC already serializes each customer's order. Derive links on
-- insertion so a caller cannot attach another customer's appointment history.
create function public.link_appointment_follow_up() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.previous_id is not null then
   select a.follow_up_of into new.follow_up_of from public.measurement_appointments a
   where a.id=new.previous_id and a.order_id=new.order_id;
 else
   select a.id into new.follow_up_of from public.measurement_appointments a
   where a.order_id=new.order_id and a.status in ('completed','no_show')
   order by a.outcome_at desc,a.id desc limit 1;
 end if;
 return new;
end; $$;
create trigger appointment_follow_up_link before insert on public.measurement_appointments
 for each row execute function public.link_appointment_follow_up();
revoke all on function public.link_appointment_follow_up() from public,anon,authenticated;

create function public.record_appointment_outcome(target_appointment uuid,session_outcome text,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.measurement_appointments;
begin
 if confirmed is distinct from true or session_outcome is null or session_outcome not in ('completed','no_show') then
   raise exception 'Confirm a completed or no-show preview outcome';
 end if;
 select * into a from public.measurement_appointments where id=target_appointment;
 if not found or a.owner_id is distinct from auth.uid() then raise exception 'Appointment not available'; end if;
 -- Same lock order as reservation/cancellation. Recheck ownership after locks.
 perform 1 from public.profiles where id=a.customer_id for update;
 perform 1 from public.customer_orders where id=a.order_id for update;
 perform pg_advisory_xact_lock(hashtextextended(a.owner_id::text,1313));
 select * into a from public.measurement_appointments where id=target_appointment for update;
 perform 1 from public.boutiques where id=a.boutique_id and owner_id=auth.uid() and status='verified' for share;
 if not found or a.owner_id is distinct from auth.uid() then raise exception 'Appointment not available'; end if;
 if a.status=session_outcome then return a.id; end if;
 if a.status<>'confirmed' then raise exception 'An outcome is final; reload this appointment before continuing'; end if;
 if a.ends_at>now() then raise exception 'Record an outcome only after the session ends'; end if;
 update public.measurement_appointments set status=session_outcome,outcome_at=now(),outcome_by=auth.uid() where id=a.id;
 -- Keep the historical slot booked; its elapsed time must not be recycled.
 insert into public.audit_events(actor_id,action,entity_type,entity_id)
 values(auth.uid(),'appointment.'||session_outcome,'measurement_appointment',a.id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
 values('appointment.preview_'||session_outcome,'measurement_appointment',a.id::text,jsonb_build_object('appointment_id',a.id));
 return a.id;
end; $$;
revoke all on function public.record_appointment_outcome(uuid,text,boolean) from public,anon;
grant execute on function public.record_appointment_outcome(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
