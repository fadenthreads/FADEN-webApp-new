-- Private preview feedback: never a public rating or a promise of alterations.
create table public.order_aftercare_items (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 kind text not null check(kind in ('review','alteration')),
 rating integer,
 body text not null check(length(btrim(body)) between 10 and 2000),
 status text not null,
 version integer not null default 1 check(version between 1 and 10),
 mode text not null default 'rehearsal' check(mode='rehearsal'),
 created_at timestamptz not null default now(),
 check((kind='review' and rating between 1 and 5 and rating is not null and status='submitted') or (kind='alteration' and rating is null and status in ('requested','accepted','declined','ready','closed','cancelled')))
);
create unique index aftercare_one_review on public.order_aftercare_items(order_id) where kind='review';
create unique index aftercare_one_active_alteration on public.order_aftercare_items(order_id) where kind='alteration' and status in ('requested','accepted','ready');
create index aftercare_order_history on public.order_aftercare_items(order_id,created_at);
create table public.order_aftercare_events (
 id uuid primary key,
 item_id uuid not null references public.order_aftercare_items(id) on delete restrict,
 version integer not null check(version between 2 and 10),
 status text not null check(status in ('accepted','declined','ready','closed','cancelled')),
 note text not null check(length(btrim(note)) between 10 and 2000),
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(item_id,version)
);
alter table public.order_aftercare_items enable row level security;
alter table public.order_aftercare_events enable row level security;
revoke all on public.order_aftercare_items,public.order_aftercare_events from anon,authenticated;
grant select on public.order_aftercare_items,public.order_aftercare_events to authenticated;
grant all on public.order_aftercare_items,public.order_aftercare_events to service_role;
create policy aftercare_private_read on public.order_aftercare_items for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id));
create policy aftercare_events_private_read on public.order_aftercare_events for select to authenticated using(exists(select 1 from public.order_aftercare_items i where i.id=item_id));

create function public.submit_aftercare_rehearsal(target_order uuid,item_kind text,stars integer,customer_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; retry public.order_aftercare_items;
begin
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this private aftercare rehearsal'; end if;
 if not exists(select 1 from public.order_delivery_confirmations where order_id=o.id) then raise exception 'Confirm the delivery rehearsal before aftercare'; end if;
 perform 1 from public.boutiques where id=o.boutique_id and owner_id=o.boutique_owner_id and status='verified' and is_published for share;
 if not found then raise exception 'The original boutique is unavailable; aftercare needs support'; end if;
 if command_id is null or item_kind is null or item_kind not in ('review','alteration') or customer_note is null or length(btrim(customer_note)) not between 10 and 2000
 or (item_kind='review' and (stars is null or stars not between 1 and 5)) or (item_kind='alteration' and stars is not null) then raise exception 'Choose a valid feedback type, rating and 10–2000 character description'; end if;
 select * into retry from public.order_aftercare_items where id=command_id;
 if found then
 if retry.order_id=o.id and retry.kind=item_kind and retry.rating is not distinct from stars and retry.body=btrim(customer_note) then return retry.id; end if;
 raise exception 'Submission reference already used'; end if;
 if item_kind='review' and exists(select 1 from public.order_aftercare_items where order_id=o.id and kind='review') then raise exception 'A private preview review is already recorded'; end if;
 if item_kind='alteration' and exists(select 1 from public.order_aftercare_items where order_id=o.id and kind='alteration' and status in ('requested','accepted','ready')) then raise exception 'An alteration request is already open'; end if;
 if (select count(*) from public.order_aftercare_items where order_id=o.id and kind='alteration')>=10 and item_kind='alteration' then raise exception 'Alteration history limit reached'; end if;
 insert into public.order_aftercare_items(id,order_id,kind,rating,body,status) values(command_id,o.id,item_kind,stars,btrim(customer_note),case when item_kind='review' then 'submitted' else 'requested' end);
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'aftercare.rehearsal_submitted','aftercare_item',command_id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('aftercare.rehearsal_submitted','aftercare_item',command_id::text,jsonb_build_object('item_id',command_id,'order_id',o.id));
 return command_id;
end; $$;

create function public.update_aftercare_rehearsal(target_item uuid,expected_version integer,next_status text,response_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.order_aftercare_items; o public.customer_orders; retry public.order_aftercare_events; owner_action boolean;
begin
 select * into i from public.order_aftercare_items where id=target_item;
 if not found then raise exception 'Request not available'; end if;
 select * into o from public.customer_orders where id=i.order_id and (customer_id=auth.uid() or boutique_owner_id=auth.uid()) for update;
 if not found or o.status='cancelled' then raise exception 'Request not available'; end if;
 owner_action=(o.boutique_owner_id=auth.uid());
 if owner_action then
 perform 1 from public.boutiques where id=o.boutique_id and owner_id=auth.uid() and status='verified' and is_published for share;
 if not found then raise exception 'Request not available'; end if;
 end if;
 if confirmed is distinct from true then raise exception 'Confirm this alteration rehearsal update'; end if;
 if command_id is null or expected_version is null or expected_version not between 1 and 9 or next_status is null or response_note is null or length(btrim(response_note)) not between 10 and 2000 then raise exception 'Provide a valid response and confirmation'; end if;
 select * into i from public.order_aftercare_items where id=target_item for update;
 if i.kind<>'alteration' then raise exception 'Preview reviews cannot be changed'; end if;
 select * into retry from public.order_aftercare_events where id=command_id;
 if found then
 if retry.item_id=i.id and retry.actor_id=auth.uid() and retry.version=expected_version+1 and retry.status=next_status and retry.note=btrim(response_note) then return retry.id; end if;
 raise exception 'Submission reference already used'; end if;
 if i.version<>expected_version then raise exception 'Request changed; reload before responding'; end if;
 if not coalesce((owner_action and ((i.status='requested' and next_status in ('accepted','declined')) or (i.status='accepted' and next_status='ready')))
 or (not owner_action and ((i.status='requested' and next_status='cancelled') or (i.status='ready' and next_status='closed'))),false) then raise exception 'This action is not allowed at the current request stage'; end if;
 update public.order_aftercare_items set status=next_status,version=version+1 where id=i.id;
 insert into public.order_aftercare_events(id,item_id,version,status,note,actor_id) values(command_id,i.id,expected_version+1,next_status,btrim(response_note),auth.uid());
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'aftercare.rehearsal_updated','aftercare_event',command_id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('aftercare.rehearsal_updated','aftercare_event',command_id::text,jsonb_build_object('item_id',i.id,'event_id',command_id));
 return command_id;
end; $$;
revoke all on function public.submit_aftercare_rehearsal(uuid,text,integer,text,uuid,boolean),public.update_aftercare_rehearsal(uuid,integer,text,text,uuid,boolean) from public,anon;
grant execute on function public.submit_aftercare_rehearsal(uuid,text,integer,text,uuid,boolean),public.update_aftercare_rehearsal(uuid,integer,text,text,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
