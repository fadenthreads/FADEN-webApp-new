-- Customer-owned request drafts. Submission does not share private data with boutiques.
create table public.outfit_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 boutique_id uuid references public.boutiques(id) on delete restrict,
 design_id uuid references public.designs(id) on delete restrict,
 status text not null default 'draft' check (status in ('draft','submitted')),
 draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft)='object' and octet_length(draft::text)<=50000),
 version integer not null default 1,
 submitted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index outfit_requests_owner_idx on public.outfit_requests(user_id, updated_at desc);
alter table public.outfit_requests enable row level security;
revoke all on public.outfit_requests from anon, authenticated;
grant select on public.outfit_requests to authenticated;
grant insert(user_id,boutique_id,design_id) on public.outfit_requests to authenticated;
grant update(draft) on public.outfit_requests to authenticated;
create policy request_owner_read on public.outfit_requests for select to authenticated using(user_id=auth.uid());
create policy request_owner_create on public.outfit_requests for insert to authenticated with check (
 user_id=auth.uid() and status='draft'
 and (boutique_id is null or exists(select 1 from public.boutiques b where b.id=boutique_id and b.is_published and b.status='verified'))
 and (design_id is null or exists(select 1 from public.designs d where d.id=design_id and d.status='published' and (boutique_id is null or d.boutique_id=outfit_requests.boutique_id)))
);
create policy request_owner_edit on public.outfit_requests for update to authenticated using(user_id=auth.uid() and status='draft') with check(user_id=auth.uid() and status='draft');
create function public.version_outfit_request() returns trigger language plpgsql set search_path='' as $$
begin
 new.version=old.version+1;
 new.updated_at=now();
 return new;
end; $$;
create trigger outfit_request_version before update on public.outfit_requests for each row execute function public.version_outfit_request();

-- Explicit submit transition: ownership, optimistic concurrency and minimum data enforced in DB.
create function public.submit_outfit_request(request_id uuid, expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.outfit_requests; v jsonb;
begin
 select * into r from public.outfit_requests where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status='submitted' then return r.id; end if;
 if r.version<>expected_version then raise exception 'Draft changed; reload before submitting'; end if;
 v=r.draft;
 if coalesce(v->>'occasion','') not in ('Wedding','Reception','Engagement','Festival','Other')
 or coalesce(v->>'garment','') not in ('Lehenga','Saree','Dress','Suit','Sherwani','Blouse','Other')
 or coalesce(v->>'budget','') not in ('under_10k','10k_25k','25k_50k','50k_100k','100k_plus','custom')
 or coalesce(v->>'measurementMethod','') not in ('manual','saved','boutique','video','home','later')
 or not coalesce((v->>'consent')::boolean,false)
 or (not coalesce((v->>'expert')::boolean,false) and coalesce(v->>'silhouette','')='')
 then raise exception 'Complete all required request details and confirm consent'; end if;
 if coalesce(v->>'deliveryDate','')='' or coalesce(v->>'eventDate','')='' then raise exception 'Dates are required'; end if;
 if (v->>'deliveryDate')::date<current_date or (v->>'eventDate')::date<(v->>'deliveryDate')::date then raise exception 'Check event and delivery dates'; end if;
 if v->>'measurementMethod' in ('manual','saved') then
   if not (jsonb_typeof(v->'measurements')='object') or coalesce(v->'measurements'->>'unit','') not in ('cm','in') then raise exception 'Measurements are required'; end if;
   if coalesce((v->'measurements'->>'chest')::numeric,0)<=0 or coalesce((v->'measurements'->>'waist')::numeric,0)<=0 or coalesce((v->'measurements'->>'hips')::numeric,0)<=0 then raise exception 'Measurements are incomplete'; end if;
 end if;
 update public.outfit_requests set status='submitted',submitted_at=now() where id=r.id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
 values('outfit_request.submitted','outfit_request',r.id::text,jsonb_build_object('request_id',r.id));
 return r.id;
end; $$;
revoke all on function public.submit_outfit_request(uuid,integer) from public;
grant execute on function public.submit_outfit_request(uuid,integer) to authenticated;

create table public.measurement_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 measurements jsonb not null check(jsonb_typeof(measurements)='object' and octet_length(measurements::text)<2000),
 updated_at timestamptz not null default now()
);
alter table public.measurement_profiles enable row level security;
revoke all on public.measurement_profiles from anon, authenticated;
grant select,insert,update on public.measurement_profiles to authenticated;
create policy measurement_owner on public.measurement_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create trigger measurements_updated before update on public.measurement_profiles for each row execute function public.set_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('request-inspiration','request-inspiration',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy inspiration_owner_read on storage.objects for select to authenticated using(
 bucket_id='request-inspiration' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.outfit_requests r where r.id::text=(storage.foldername(name))[2] and r.user_id=auth.uid())
);
create policy inspiration_owner_upload on storage.objects for insert to authenticated with check(
 bucket_id='request-inspiration' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.outfit_requests r where r.id::text=(storage.foldername(name))[2] and r.user_id=auth.uid() and r.status='draft')
);
create policy inspiration_owner_delete on storage.objects for delete to authenticated using(
 bucket_id='request-inspiration' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.outfit_requests r where r.id::text=(storage.foldername(name))[2] and r.user_id=auth.uid() and r.status='draft')
);
