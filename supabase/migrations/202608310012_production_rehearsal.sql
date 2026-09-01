-- Rehearsal progress only. No commercial order/payment/fulfilment state changes.
create table public.order_production_updates (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 sequence integer not null check(sequence between 1 and 100),
 stage integer not null check(stage between 1 and 5),
 mode text not null default 'rehearsal' check(mode='rehearsal'),
 note text not null check(length(btrim(note)) between 10 and 2000),
 photo_path text,
 created_at timestamptz not null default now(),
 unique(order_id,sequence)
);
alter table public.order_production_updates enable row level security;
revoke all on public.order_production_updates from anon,authenticated;
grant select on public.order_production_updates to authenticated;
grant select,insert,update,delete on public.order_production_updates to service_role;
create policy production_order_read on public.order_production_updates for select to authenticated
 using(exists(select 1 from public.customer_orders o where o.id=order_id));
create view public.order_production_summary with(security_invoker=true) as
 select distinct on(order_id) order_id,stage,sequence,created_at from public.order_production_updates
 order by order_id,sequence desc;
revoke all on public.order_production_summary from anon,authenticated;
grant select on public.order_production_summary to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-progress','order-progress',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy progress_photo_upload on storage.objects for insert to authenticated with check(
 bucket_id='order-progress' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and exists(select 1 from public.customer_orders o where o.id::text=split_part(name,'/',1)
 and o.status<>'cancelled' and o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id)
 and (select r.status from public.order_design_reviews r where r.order_id=o.id order by r.revision desc limit 1)='approved')
);
create policy progress_photo_read on storage.objects for select to authenticated using(
 bucket_id='order-progress' and exists(select 1 from public.customer_orders o where o.id::text=split_part(name,'/',1) and (
 (o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id)) or
 (o.customer_id=auth.uid() and exists(select 1 from public.order_production_updates p where p.order_id=o.id and p.photo_path=name))
 ))
);

create function public.record_production_update(target_order uuid,expected_sequence integer,target_stage integer,progress_note text,photo text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; previous public.order_production_updates; retry public.order_production_updates;
begin
 select * into o from public.customer_orders where id=target_order and boutique_owner_id=auth.uid() for update;
 if not found or not public.owns_verified_atelier(o.boutique_id) then raise exception 'Order not available'; end if;
 if o.status='cancelled' then raise exception 'Cancelled orders cannot receive progress updates'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this is a rehearsal update, not live production'; end if;
 if command_id is null or expected_sequence is null or expected_sequence<0 or expected_sequence>=100
 or target_stage is null or target_stage not between 1 and 5
 or progress_note is null or length(btrim(progress_note)) not between 10 and 2000
 then raise exception 'Provide a valid stage and a note between 10 and 2000 characters'; end if;
 if (select status from public.order_design_reviews where order_id=o.id order by revision desc limit 1) is distinct from 'approved'
 then raise exception 'Customer design approval is required before rehearsing production'; end if;
 select * into retry from public.order_production_updates where id=command_id;
 if found then
   if retry.order_id=o.id and retry.sequence=expected_sequence+1 and retry.stage=target_stage
   and retry.note=btrim(progress_note) and retry.photo_path is not distinct from photo then return retry.id; end if;
   raise exception 'This submission reference is already used; reload before retrying';
 end if;
 select * into previous from public.order_production_updates where order_id=o.id order by sequence desc limit 1;
 if coalesce(previous.sequence,0)<>expected_sequence then raise exception 'Progress changed; reload before updating'; end if;
 if (previous.id is null and target_stage<>1) or (previous.id is not null and target_stage not between previous.stage and least(previous.stage+1,5))
 then raise exception 'Record the current or next milestone; stages cannot be skipped or reversed'; end if;
 if photo is not null and (split_part(photo,'/',1)<>o.id::text or not exists(select 1 from storage.objects where bucket_id='order-progress' and name=photo))
 then raise exception 'Upload a progress photo for this order first'; end if;
 insert into public.order_production_updates(id,order_id,sequence,stage,note,photo_path)
 values(command_id,o.id,expected_sequence+1,target_stage,btrim(progress_note),photo);
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'production.rehearsal_updated','production_update',command_id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
 values('production.rehearsal_updated','production_update',command_id::text,jsonb_build_object('order_id',o.id,'update_id',command_id));
 return command_id;
end; $$;
revoke all on function public.record_production_update(uuid,integer,integer,text,text,uuid,boolean) from public,anon;
grant execute on function public.record_production_update(uuid,integer,integer,text,text,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
