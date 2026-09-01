-- Explicit, revocable disclosure snapshots. Never grant boutiques access to private drafts.
create table public.request_shares (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.outfit_requests(id) on delete cascade,
 customer_id uuid not null references public.profiles(id),
 boutique_id uuid not null references public.boutiques(id),
 client_label text not null,
 brief jsonb not null,
 include_measurements boolean not null default false,
 include_inspiration boolean not null default false,
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(request_id,boutique_id)
);
create index request_shares_boutique_idx on public.request_shares(boutique_id,created_at desc);
alter table public.request_shares enable row level security;
revoke all on public.request_shares from anon,authenticated;
grant select on public.request_shares to authenticated;

create function public.owns_verified_atelier(boutique uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.boutiques b where b.id=boutique and b.owner_id=auth.uid() and b.status='verified' and b.is_published);
$$;
revoke all on function public.owns_verified_atelier(uuid) from public;
grant execute on function public.owns_verified_atelier(uuid) to authenticated;
create policy share_customer_read on public.request_shares for select to authenticated using(customer_id=auth.uid());
create policy share_atelier_read on public.request_shares for select to authenticated using(revoked_at is null and public.owns_verified_atelier(boutique_id));

create function public.share_outfit_request(target_request uuid,target_boutique uuid,measurements_allowed boolean,inspiration_allowed boolean,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.outfit_requests; s public.request_shares; snapshot jsonb; result uuid; label text;
begin
 if confirmed is distinct from true or measurements_allowed is null or inspiration_allowed is null then raise exception 'Confirm exactly what you want to share'; end if;
 select * into r from public.outfit_requests where id=target_request and user_id=auth.uid() for update;
 if not found or r.status<>'submitted' then raise exception 'Submitted request not found'; end if;
 if not exists(select 1 from public.boutiques where id=target_boutique and status='verified' and is_published and owner_id<>auth.uid()) then raise exception 'Choose an available verified boutique'; end if;
 select * into s from public.request_shares where request_id=r.id and boutique_id=target_boutique;
 if found then
   if s.revoked_at is not null then raise exception 'This sharing invitation was revoked; start a new request to invite again'; end if;
   if s.include_measurements<>measurements_allowed or s.include_inspiration<>inspiration_allowed then raise exception 'Sharing permissions are fixed for this invitation; revoke it to stop access'; end if;
   return s.id;
 end if;
 if (select count(*) from public.request_shares where request_id=r.id and revoked_at is null)>=3 then raise exception 'Share with up to three boutiques at a time'; end if;
 -- Allowlist prevents future private draft fields from leaking by default.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into snapshot from jsonb_each(r.draft)
 where key in ('occasion','garment','notes','expert','colors','silhouette','neckline','sleeves','fabrics','measurementMethod','eventDate','deliveryDate','budget');
 if measurements_allowed then snapshot=snapshot||jsonb_build_object('measurements',r.draft->'measurements'); end if;
 if inspiration_allowed then snapshot=snapshot||jsonb_build_object('links',coalesce(r.draft->'links','[]'::jsonb),'inspirations',coalesce(r.draft->'inspirations','[]'::jsonb)); end if;
 select coalesce(nullif(display_name,''),'FADEN customer') into label from public.profiles where id=auth.uid();
 insert into public.request_shares(request_id,customer_id,boutique_id,client_label,brief,include_measurements,include_inspiration)
 values(r.id,auth.uid(),target_boutique,label,snapshot,measurements_allowed,inspiration_allowed) returning id into result;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('request.shared','request_share',result::text,jsonb_build_object('share_id',result));
 return result;
end; $$;

create table public.boutique_offers (
 id uuid primary key default gen_random_uuid(),
 share_id uuid not null unique references public.request_shares(id) on delete cascade,
 request_id uuid not null references public.outfit_requests(id) on delete cascade,
 customer_id uuid not null references public.profiles(id),
 boutique_id uuid not null references public.boutiques(id),
 quote jsonb not null default '{}'::jsonb,
 subtotal_paise bigint not null default 0,
 tax_paise bigint not null default 0,
 total_paise bigint not null default 0,
 status text not null default 'draft' check(status in ('draft','sent','declined','withdrawn')),
 version integer not null default 1,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.boutique_offers enable row level security;
revoke all on public.boutique_offers from anon,authenticated;
grant select on public.boutique_offers to authenticated;
create policy offer_customer_read on public.boutique_offers for select to authenticated using(customer_id=auth.uid() and sent_at is not null);
create policy offer_atelier_read on public.boutique_offers for select to authenticated using(public.owns_verified_atelier(boutique_id) and exists(select 1 from public.request_shares s where s.id=share_id and s.revoked_at is null));

-- Internal notes are structurally separate from every customer-visible row.
create table public.atelier_request_notes (
 share_id uuid primary key references public.request_shares(id) on delete cascade,
 notes text not null check(length(notes)<=5000),
 updated_at timestamptz not null default now()
);
alter table public.atelier_request_notes enable row level security;
revoke all on public.atelier_request_notes from anon,authenticated;
grant select,insert,update on public.atelier_request_notes to authenticated;
create policy atelier_notes_owner on public.atelier_request_notes for all to authenticated
using(exists(select 1 from public.request_shares s where s.id=share_id and s.revoked_at is null and public.owns_verified_atelier(s.boutique_id)))
with check(exists(select 1 from public.request_shares s where s.id=share_id and s.revoked_at is null and public.owns_verified_atelier(s.boutique_id)));
create trigger atelier_notes_updated before update on public.atelier_request_notes for each row execute function public.set_updated_at();

create function public.save_boutique_offer(target_share uuid,expected_version integer,proposal jsonb,send_now boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.request_shares; o public.boutique_offers; item jsonb; qty integer; price bigint; subtotal bigint=0; tax bigint; total bigint; bps integer; advance bigint; result uuid; label text; detail text; clean_items jsonb='[]'; clean jsonb;
begin
 select * into s from public.request_shares where id=target_share for update;
 if not found or s.revoked_at is not null or not public.owns_verified_atelier(s.boutique_id) then raise exception 'Active request invitation not found'; end if;
 select * into o from public.boutique_offers where share_id=s.id for update;
 if found then
   if o.status='sent' and send_now and o.version=expected_version+1 and o.quote=proposal then return o.id; end if;
   if o.status<>'draft' then raise exception 'This offer is locked'; end if;
   if o.version is distinct from expected_version then raise exception 'Offer changed; reload before saving'; end if;
 elsif expected_version is distinct from 0 then raise exception 'Offer changed; reload before saving'; end if;
 if send_now is null or proposal is null or jsonb_typeof(proposal)<>'object' or octet_length(proposal::text)>20000 then raise exception 'Invalid proposal'; end if;
 if jsonb_typeof(proposal->'items') is distinct from 'array' then raise exception 'Add line items'; end if;
 if jsonb_array_length(proposal->'items') not between 1 and 20 then raise exception 'Use one to twenty line items'; end if;
 for item in select * from jsonb_array_elements(proposal->'items') loop
   label=trim(item->>'label'); detail=coalesce(item->>'detail','');
   if label is null or length(label) not between 1 and 120 or length(detail)>300
      or coalesce(item->>'quantity','') !~ '^[0-9]+$' or coalesce(item->>'unit_paise','') !~ '^[0-9]+$' then raise exception 'Check line item details'; end if;
   qty=(item->>'quantity')::integer; price=(item->>'unit_paise')::bigint;
   if qty not between 1 and 100 or price not between 0 and 100000000 then raise exception 'Check quantity and price'; end if;
   subtotal=subtotal+qty*price;
   clean_items=clean_items||jsonb_build_array(jsonb_build_object('label',label,'detail',detail,'quantity',qty,'unit_paise',price));
 end loop;
 if coalesce(proposal->>'tax_bps','') !~ '^[0-9]+$' or coalesce(proposal->>'advance_paise','') !~ '^[0-9]+$' then raise exception 'Check tax and advance'; end if;
 bps=(proposal->>'tax_bps')::integer; advance=(proposal->>'advance_paise')::bigint;
 if bps not between 0 and 10000 then raise exception 'Check tax rate'; end if;
 tax=round(subtotal::numeric*bps/10000); total=subtotal+tax;
 if total>1000000000 or advance>total then raise exception 'Check total and advance'; end if;
 if length(coalesce(proposal->>'terms',''))>5000 or length(coalesce(proposal->>'title','')) not between 1 and 160 then raise exception 'Check title and terms'; end if;
 clean=jsonb_build_object('title',proposal->>'title','items',clean_items,'tax_bps',bps,'advance_paise',advance,'delivery_date',coalesce(proposal->>'delivery_date',''),'expires_on',coalesce(proposal->>'expires_on',''),'terms',coalesce(proposal->>'terms',''));
 if send_now then
   if total<=0 or length(trim(clean->>'terms'))<10 then raise exception 'Add a positive quote and clear terms before sending'; end if;
   if (clean->>'delivery_date') !~ '^\d{4}-\d{2}-\d{2}$' or (clean->>'expires_on') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Set completion and expiry dates'; end if;
   if (clean->>'delivery_date')::date<current_date or (clean->>'expires_on')::date<current_date or (clean->>'expires_on')::date>(clean->>'delivery_date')::date then raise exception 'Check completion and expiry dates'; end if;
 end if;
 if o.id is null then
   insert into public.boutique_offers(share_id,request_id,customer_id,boutique_id,quote,subtotal_paise,tax_paise,total_paise,status,sent_at)
   values(s.id,s.request_id,s.customer_id,s.boutique_id,clean,subtotal,tax,total,case when send_now then 'sent' else 'draft' end,case when send_now then now() end) returning id into result;
 else
   update public.boutique_offers set quote=clean,subtotal_paise=subtotal,tax_paise=tax,total_paise=total,status=case when send_now then 'sent' else 'draft' end,sent_at=case when send_now then now() end,version=version+1,updated_at=now() where id=o.id returning id into result;
 end if;
 if send_now then insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('offer.sent','boutique_offer',result::text,jsonb_build_object('offer_id',result)); end if;
 return result;
end; $$;

create function public.revoke_request_share(target_share uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.request_shares;
begin
 select * into s from public.request_shares where id=target_share and customer_id=auth.uid() for update;
 if not found then raise exception 'Invitation not found'; end if;
 if s.revoked_at is not null then return; end if;
 update public.request_shares set revoked_at=now() where id=s.id;
 update public.boutique_offers set status='withdrawn',version=version+1,updated_at=now() where share_id=s.id and status in ('draft','sent');
end; $$;

create function public.close_boutique_offer(target_offer uuid,expected_version integer,action text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.boutique_offers;
begin
 select * into o from public.boutique_offers where id=target_offer for update;
 if not found then raise exception 'Offer not found'; end if;
 if not ((action='declined' and o.customer_id=auth.uid()) or (action='withdrawn' and public.owns_verified_atelier(o.boutique_id))) then raise exception 'Action not permitted'; end if;
 if o.status=action then return; end if;
 if o.version is distinct from expected_version or o.status<>'sent' then raise exception 'Offer changed; reload before continuing'; end if;
 update public.boutique_offers set status=action,version=version+1,updated_at=now() where id=o.id;
end; $$;

revoke all on function public.share_outfit_request(uuid,uuid,boolean,boolean,boolean), public.save_boutique_offer(uuid,integer,jsonb,boolean), public.revoke_request_share(uuid), public.close_boutique_offer(uuid,integer,text) from public;
grant execute on function public.share_outfit_request(uuid,uuid,boolean,boolean,boolean), public.save_boutique_offer(uuid,integer,jsonb,boolean), public.revoke_request_share(uuid), public.close_boutique_offer(uuid,integer,text) to authenticated;

-- Existing signed URLs remain valid until expiry (15 minutes); revocation prevents new signing.
create policy inspiration_shared_atelier_read on storage.objects for select to authenticated using(
 bucket_id='request-inspiration' and exists(
   select 1 from public.request_shares s where s.revoked_at is null and s.include_inspiration and public.owns_verified_atelier(s.boutique_id)
   and (storage.foldername(storage.objects.name))[1]=s.customer_id::text
   and (storage.foldername(storage.objects.name))[2]=s.request_id::text
   and s.brief->'inspirations' @> jsonb_build_array(jsonb_build_object('key',storage.objects.name))
 )
);
