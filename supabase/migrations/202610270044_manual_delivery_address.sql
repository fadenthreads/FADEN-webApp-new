-- Customer address updates participate in the same order lock as Admin manual
-- shipping. Keep the original revision/idempotency and audience checks.
create function public.lock_manual_shipment_order() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.customer_orders where id=new.order_id for update;
 return new;
end; $$;
revoke all on function public.lock_manual_shipment_order() from public, anon, authenticated;
create trigger lock_manual_shipment_order before insert or update on public.manual_order_shipments
for each row execute function public.lock_manual_shipment_order();

create or replace function public.save_order_delivery_details(target_order uuid,expected_revision integer,details jsonb,command_id uuid,confirmed boolean) returns integer
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
 if exists(select 1 from public.manual_order_shipments where order_id=o.id and status <> 'cancelled') then
   raise exception 'Address is locked while delivery is arranged; contact FADEN for corrections';
 end if;
 insert into public.order_delivery_details(order_id,revision,address,last_command_id)
 values(o.id,expected_revision+1,details,command_id)
 on conflict(order_id) do update set revision=excluded.revision,address=excluded.address,last_command_id=excluded.last_command_id,confirmed_at=now();
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'delivery.address_confirmed','order',o.id::text);
 return expected_revision+1;
end; $$;
