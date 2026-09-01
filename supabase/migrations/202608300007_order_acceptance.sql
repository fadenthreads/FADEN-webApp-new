-- Accepted proposals are immutable commerce snapshots, not proof of payment.
alter table public.boutique_offers drop constraint boutique_offers_status_check;
alter table public.boutique_offers add constraint boutique_offers_status_check check(status in ('draft','sent','declined','withdrawn','accepted'));
create table public.customer_orders (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.outfit_requests(id) on delete restrict,
 offer_id uuid not null unique references public.boutique_offers(id) on delete restrict,
 share_id uuid not null references public.request_shares(id) on delete restrict,
 customer_id uuid not null references public.profiles(id),
 boutique_id uuid not null references public.boutiques(id),
 boutique_owner_id uuid not null references public.profiles(id),
 boutique_name text not null,
 quote jsonb not null,
 subtotal_paise bigint not null check(subtotal_paise>=0),
 tax_paise bigint not null check(tax_paise>=0),
 total_paise bigint not null check(total_paise>0 and total_paise=subtotal_paise+tax_paise),
 advance_paise bigint not null check(advance_paise>=0 and advance_paise<=total_paise),
 currency text not null default 'INR' check(currency='INR'),
 status text not null default 'awaiting_payment' check(status='awaiting_payment'),
 accepted_offer_version integer not null,
 consent_version text not null default 'offer-acceptance-v1',
 accepted_at timestamptz not null default now()
);
create index customer_orders_customer_idx on public.customer_orders(customer_id,accepted_at desc);
create index customer_orders_boutique_idx on public.customer_orders(boutique_id,accepted_at desc);
alter table public.customer_orders enable row level security;
revoke all on public.customer_orders from anon,authenticated;
grant select on public.customer_orders to authenticated;
create policy order_customer_read on public.customer_orders for select to authenticated using(customer_id=auth.uid());
-- Commercial snapshot remains visible to the original boutique owner after brief access is revoked.
-- It deliberately contains no address, measurements, notes or inspiration board.
create policy order_atelier_read on public.customer_orders for select to authenticated using(boutique_owner_id=auth.uid() and public.owns_verified_atelier(boutique_id));

create function public.accept_boutique_offer(target_offer uuid,expected_version integer,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare candidate public.boutique_offers; chosen public.boutique_offers; invitation public.request_shares; existing public.customer_orders; b public.boutiques; result uuid;
begin
 if confirmed is distinct from true then raise exception 'Review and confirm the offer terms before accepting'; end if;
 select * into candidate from public.boutique_offers where id=target_offer and customer_id=auth.uid();
 if not found then raise exception 'Offer not found'; end if;
 -- One lock shared by all competing offers: serializes double-clicks and concurrent choices.
 perform 1 from public.outfit_requests where id=candidate.request_id and user_id=auth.uid() and status='submitted' for update;
 if not found then raise exception 'Submitted request not found'; end if;
 select * into existing from public.customer_orders where request_id=candidate.request_id;
 if found then
   if existing.offer_id=target_offer then return existing.id; end if;
   raise exception 'You already accepted another offer for this request';
 end if;
 -- Match the existing share -> offer lock order, so revoke and acceptance cannot race.
 select * into invitation from public.request_shares where id=candidate.share_id for update;
 if not found or invitation.revoked_at is not null then raise exception 'Boutique access was revoked'; end if;
 select * into chosen from public.boutique_offers where id=target_offer for update;
 if chosen.status<>'sent' or chosen.version is distinct from expected_version then raise exception 'Offer changed; reload and review it again'; end if;
 if coalesce(chosen.quote->>'expires_on','')='' or (chosen.quote->>'expires_on')::date<current_date then raise exception 'This offer has expired'; end if;
 if coalesce(chosen.quote->>'delivery_date','')='' or (chosen.quote->>'delivery_date')::date<current_date then raise exception 'Completion date has passed; ask the boutique for a new proposal'; end if;
 select * into b from public.boutiques where id=chosen.boutique_id and status='verified' and is_published and owner_id is not null for share;
 if not found then raise exception 'This boutique is not available for orders'; end if;
 insert into public.customer_orders(request_id,offer_id,share_id,customer_id,boutique_id,boutique_owner_id,boutique_name,quote,subtotal_paise,tax_paise,total_paise,advance_paise,accepted_offer_version)
 values(chosen.request_id,chosen.id,chosen.share_id,auth.uid(),chosen.boutique_id,b.owner_id,b.name,chosen.quote,chosen.subtotal_paise,chosen.tax_paise,chosen.total_paise,(chosen.quote->>'advance_paise')::bigint,chosen.version) returning id into result;
 update public.boutique_offers set status='accepted',version=version+1,updated_at=now() where id=chosen.id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('order.accepted','customer_order',result::text,jsonb_build_object('order_id',result));
 return result;
end; $$;
revoke all on function public.accept_boutique_offer(uuid,integer,boolean) from public;
grant execute on function public.accept_boutique_offer(uuid,integer,boolean) to authenticated;
