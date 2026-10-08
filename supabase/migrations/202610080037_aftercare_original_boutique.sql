-- Preserve the order's original verified-boutique relationship when opening
-- launch aftercare. Ownership transfers must not silently route private
-- customer feedback to a replacement owner.
create or replace function public.submit_aftercare(target_order uuid,item_kind text,stars integer,customer_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; retry public.order_aftercare_items;
begin
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this aftercare request'; end if;
 if not exists(select 1 from public.manual_order_shipments where order_id=o.id and status='delivered') then raise exception 'Delivery must be confirmed before aftercare'; end if;
 perform 1 from public.boutiques where id=o.boutique_id and owner_id=o.boutique_owner_id and status='verified' and is_published for share;
 if not found then raise exception 'The original boutique is unavailable; aftercare needs support'; end if;
 if command_id is null or item_kind not in ('review','alteration') or customer_note is null or length(btrim(customer_note)) not between 10 and 2000 or (item_kind='review' and coalesce(stars,0) not between 1 and 5) or (item_kind='alteration' and stars is not null) then raise exception 'Choose a valid feedback type, rating and 10–2000 character description'; end if;
 select * into retry from public.order_aftercare_items where id=command_id;
 if found then if retry.order_id=o.id and retry.kind=item_kind and retry.rating is not distinct from stars and retry.body=btrim(customer_note) then return retry.id; end if; raise exception 'Submission reference already used'; end if;
 if item_kind='review' and exists(select 1 from public.order_aftercare_items where order_id=o.id and kind='review') then raise exception 'A review is already recorded'; end if;
 if item_kind='alteration' and exists(select 1 from public.order_aftercare_items where order_id=o.id and kind='alteration' and status in ('requested','accepted','ready')) then raise exception 'An alteration request is already open'; end if;
 insert into public.order_aftercare_items(id,order_id,kind,rating,body,status,mode) values(command_id,o.id,item_kind,stars,btrim(customer_note),case when item_kind='review' then 'submitted' else 'requested' end,'live');
 perform public.append_audit_event('aftercare.submitted','aftercare_item',command_id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('order_id',o.id,'kind',item_kind));
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('aftercare.submitted','aftercare_item',command_id::text,jsonb_build_object('item_id',command_id,'order_id',o.id,'kind',item_kind));
 return command_id;
end; $$;

notify pgrst,'reload schema';
