-- Private, text-only staging conversations. No external notification dispatch.
create table public.order_messages (
 id uuid primary key,
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 sequence integer not null check(sequence between 1 and 500),
 sender_id uuid not null references public.profiles(id),
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 unique(order_id,sequence)
);
create table public.order_message_reads (
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 reader_id uuid not null references public.profiles(id),
 last_sequence integer not null check(last_sequence between 1 and 500),
 primary key(order_id,reader_id)
);
alter table public.order_messages enable row level security;
alter table public.order_message_reads enable row level security;
revoke all on public.order_messages,public.order_message_reads from anon,authenticated;
grant select on public.order_messages,public.order_message_reads to authenticated;
grant all on public.order_messages,public.order_message_reads to service_role;
create policy message_participant_read on public.order_messages for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id));
create policy message_own_cursor on public.order_message_reads for select to authenticated using(reader_id=auth.uid() and exists(select 1 from public.customer_orders o where o.id=order_id));

create function public.send_order_message(target_order uuid,message_body text,command_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; retry public.order_messages; next_sequence integer;
begin
 select * into o from public.customer_orders where id=target_order and (customer_id=auth.uid() or boutique_owner_id=auth.uid()) for update;
 if not found or o.status='cancelled' then raise exception 'Conversation unavailable or read-only'; end if;
 perform 1 from public.boutiques where id=o.boutique_id and owner_id=o.boutique_owner_id and status='verified' and is_published for share;
 if not found then raise exception 'The original boutique is unavailable; please contact support'; end if;
 if command_id is null or message_body is null or length(btrim(message_body)) not between 1 and 2000 then raise exception 'Write a message between 1 and 2000 characters'; end if;
 select * into retry from public.order_messages where id=command_id;
 if found then
  if retry.order_id=o.id and retry.sender_id=auth.uid() and retry.body=btrim(message_body) then return retry.id; end if;
  raise exception 'Message reference already used';
 end if;
 if (select count(*) from public.order_messages where order_id=o.id and sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'Too many messages; please wait a minute'; end if;
 select coalesce(max(sequence),0)+1 into next_sequence from public.order_messages where order_id=o.id;
 if next_sequence>500 then raise exception 'Conversation preview limit reached'; end if;
 insert into public.order_messages(id,order_id,sequence,sender_id,body) values(command_id,o.id,next_sequence,auth.uid(),btrim(message_body));
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'order.message_sent','order_message',command_id::text);
 return command_id;
end; $$;

create function public.mark_order_messages_read(target_order uuid,through_sequence integer) returns void
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders;
begin
 select * into o from public.customer_orders where id=target_order and (customer_id=auth.uid() or boutique_owner_id=auth.uid()) for update;
 if not found then raise exception 'Conversation unavailable'; end if;
 if o.boutique_owner_id=auth.uid() then
  perform 1 from public.boutiques where id=o.boutique_id and owner_id=auth.uid() and status='verified' and is_published for share;
  if not found then raise exception 'Conversation unavailable'; end if;
 end if;
 if through_sequence is null or not exists(select 1 from public.order_messages where order_id=o.id and sequence=through_sequence) then raise exception 'Reload the conversation before marking it read'; end if;
 insert into public.order_message_reads(order_id,reader_id,last_sequence) values(o.id,auth.uid(),through_sequence)
 on conflict(order_id,reader_id) do update set last_sequence=greatest(public.order_message_reads.last_sequence,excluded.last_sequence);
end; $$;
revoke all on function public.send_order_message(uuid,text,uuid),public.mark_order_messages_read(uuid,integer) from public,anon;
grant execute on function public.send_order_message(uuid,text,uuid),public.mark_order_messages_read(uuid,integer) to authenticated;
notify pgrst,'reload schema';
