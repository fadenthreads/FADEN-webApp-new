-- Serialize progress commands per order before checking the idempotency key.
-- The explicit advisory lock makes concurrent HTTP retries deterministic even
-- when they arrive on separate PostgREST connections at the same instant.
create or replace function public.record_production_update(target_order uuid,expected_sequence integer,target_stage integer,progress_note text,photo text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; previous public.order_production_updates; retry public.order_production_updates;
begin
 if target_order is null then raise exception 'Order not available'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_order::text,0));
 select * into o from public.customer_orders where id=target_order and boutique_owner_id=auth.uid() for update;
 if not found or not public.owns_verified_atelier(o.boutique_id) then raise exception 'Order not available'; end if;
 if o.status='cancelled' then raise exception 'Cancelled orders cannot receive progress updates'; end if;
 if not exists(select 1 from public.order_payment_attempts where order_id=o.id and status='captured') then raise exception 'A confirmed payment is required before production'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this production update'; end if;
 if command_id is null or expected_sequence is null or expected_sequence<0 or expected_sequence>=100 or target_stage is null or target_stage not between 1 and 5 or progress_note is null or length(btrim(progress_note)) not between 10 and 2000 then raise exception 'Provide a valid stage and a note between 10 and 2000 characters'; end if;
 if (select status from public.order_design_reviews where order_id=o.id order by revision desc limit 1) is distinct from 'approved' then raise exception 'Customer design approval is required before production'; end if;
 select * into retry from public.order_production_updates where id=command_id;
 if found then if retry.order_id=o.id and retry.sequence=expected_sequence+1 and retry.stage=target_stage and retry.note=btrim(progress_note) and retry.photo_path is not distinct from photo then return retry.id; end if; raise exception 'This submission reference is already used; reload before retrying'; end if;
 select * into previous from public.order_production_updates where order_id=o.id order by sequence desc limit 1;
 if coalesce(previous.sequence,0)<>expected_sequence then raise exception 'Progress changed; reload before updating'; end if;
 if (previous.id is null and target_stage<>1) or (previous.id is not null and target_stage not between previous.stage and least(previous.stage+1,5)) then raise exception 'Record the current or next milestone; stages cannot be skipped or reversed'; end if;
 if photo is not null and (split_part(photo,'/',1)<>o.id::text or not exists(select 1 from storage.objects where bucket_id='order-progress' and name=photo)) then raise exception 'Upload a progress photo for this order first'; end if;
 insert into public.order_production_updates(id,order_id,sequence,stage,note,photo_path) values(command_id,o.id,expected_sequence+1,target_stage,btrim(progress_note),photo);
 perform public.append_audit_event('production.updated','production_update',command_id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('order_id',o.id,'stage',target_stage));
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('production.updated','production_update',command_id::text,jsonb_build_object('order_id',o.id,'update_id',command_id,'stage',target_stage));
 return command_id;
end; $$;

notify pgrst,'reload schema';
