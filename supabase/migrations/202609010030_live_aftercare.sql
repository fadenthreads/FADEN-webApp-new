-- Reuse the existing private aftercare tables but allow launch records and
-- tie eligibility to the Admin-recorded delivery state rather than rehearsal.
alter table public.order_aftercare_items drop constraint order_aftercare_items_mode_check;
alter table public.order_aftercare_items add constraint order_aftercare_items_mode_check check(mode in ('rehearsal','live'));

create function public.submit_aftercare(target_order uuid,item_kind text,stars integer,customer_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; retry public.order_aftercare_items;
begin
 select * into o from public.customer_orders where id=target_order and customer_id=auth.uid() for update;
 if not found or o.status='cancelled' then raise exception 'Order not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this aftercare request'; end if;
 if not exists(select 1 from public.manual_order_shipments where order_id=o.id and status='delivered') then raise exception 'Delivery must be confirmed before aftercare'; end if;
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

create function public.update_aftercare(target_item uuid,expected_version integer,next_status text,response_note text,command_id uuid,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.order_aftercare_items; o public.customer_orders; retry public.order_aftercare_events; owner_action boolean;
begin
 select * into i from public.order_aftercare_items where id=target_item; if not found then raise exception 'Request not available'; end if;
 select * into o from public.customer_orders where id=i.order_id and (customer_id=auth.uid() or boutique_owner_id=auth.uid()) for update; if not found or o.status='cancelled' then raise exception 'Request not available'; end if;
 owner_action=(o.boutique_owner_id=auth.uid()); if owner_action and not public.owns_verified_atelier(o.boutique_id) then raise exception 'Request not available'; end if;
 if confirmed is distinct from true then raise exception 'Confirm this aftercare update'; end if;
 if command_id is null or expected_version not between 1 and 9 or response_note is null or length(btrim(response_note)) not between 10 and 2000 then raise exception 'Provide a valid response and confirmation'; end if;
 select * into i from public.order_aftercare_items where id=target_item for update; if i.kind<>'alteration' then raise exception 'Reviews cannot be changed'; end if;
 select * into retry from public.order_aftercare_events where id=command_id; if found then if retry.item_id=i.id and retry.actor_id=auth.uid() and retry.version=expected_version+1 and retry.status=next_status and retry.note=btrim(response_note) then return retry.id; end if; raise exception 'Submission reference already used'; end if;
 if i.version<>expected_version then raise exception 'Request changed; reload before responding'; end if;
 if not coalesce((owner_action and ((i.status='requested' and next_status in ('accepted','declined')) or (i.status='accepted' and next_status='ready'))) or (not owner_action and ((i.status='requested' and next_status='cancelled') or (i.status='ready' and next_status='closed'))),false) then raise exception 'This action is not allowed at the current request stage'; end if;
 update public.order_aftercare_items set status=next_status,version=version+1 where id=i.id;
 insert into public.order_aftercare_events(id,item_id,version,status,note,actor_id) values(command_id,i.id,expected_version+1,next_status,btrim(response_note),auth.uid());
 perform public.append_audit_event('aftercare.updated','aftercare_event',command_id::text,auth.uid(),null,null,null,null,null,null,null,jsonb_build_object('item_id',i.id,'status',next_status));
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('aftercare.updated','aftercare_event',command_id::text,jsonb_build_object('item_id',i.id,'event_id',command_id,'status',next_status));
 return command_id;
end; $$;
revoke all on function public.submit_aftercare(uuid,text,integer,text,uuid,boolean),public.update_aftercare(uuid,integer,text,text,uuid,boolean) from public,anon;
grant execute on function public.submit_aftercare(uuid,text,integer,text,uuid,boolean),public.update_aftercare(uuid,integer,text,text,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
