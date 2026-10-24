-- Keep measurement charts separate from inspiration-sharing permissions.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('request-measurements','request-measurements',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy request_measurements_read on storage.objects for select to authenticated
using (bucket_id='request-measurements' and (
  public.can_write_request_inspiration(name)
  or exists (
    select 1 from public.request_shares s
    where s.revoked_at is null and s.include_measurements
      and public.owns_verified_atelier(s.boutique_id)
      and s.brief->'measurements'->>'reference'=name
      and s.customer_id::text=split_part(name,'/',1)
      and s.request_id::text=split_part(name,'/',2)
  )
));
create policy request_measurements_insert on storage.objects for insert to authenticated
with check (bucket_id='request-measurements' and public.can_write_request_inspiration(name));
create policy request_measurements_delete on storage.objects for delete to authenticated
using (bucket_id='request-measurements' and public.can_write_request_inspiration(name));

create or replace function public.submit_outfit_request(request_id uuid, expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.outfit_requests; v jsonb; reference_key text;
begin
 select * into r from public.outfit_requests where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status='submitted' then return r.id; end if;
 if r.version<>expected_version then raise exception 'Draft changed; reload before submitting'; end if;
 v=r.draft;
 if coalesce(v->>'occasion','') not in ('Wedding','Reception','Engagement','Festival','Other')
 or coalesce(v->>'garment','') not in ('Lehenga','Saree','Dress','Suit','Sherwani','Blouse','Other')
 or coalesce(v->>'budget','') not in ('under_10k','10k_25k','25k_50k','50k_100k','100k_plus','custom')
 or coalesce(v->>'measurementMethod','') not in ('manual','reference','saved','boutique','video','home','later')
 or not coalesce((v->>'consent')::boolean,false)
 or (not coalesce((v->>'expert')::boolean,false) and coalesce(v->>'silhouette','')='')
 then raise exception 'Complete all required request details and confirm consent'; end if;
 if coalesce(v->>'deliveryDate','')='' or coalesce(v->>'eventDate','')='' then raise exception 'Dates are required'; end if;
 if (v->>'deliveryDate')::date<current_date or (v->>'eventDate')::date<(v->>'deliveryDate')::date then raise exception 'Check event and delivery dates'; end if;
 if v->>'measurementMethod' in ('manual','saved') then
   if not (jsonb_typeof(v->'measurements')='object') or coalesce(v->'measurements'->>'unit','') not in ('cm','in') then raise exception 'Measurements are required'; end if;
   if coalesce((v->'measurements'->>'chest')::numeric,0)<=0 or coalesce((v->'measurements'->>'waist')::numeric,0)<=0 or coalesce((v->'measurements'->>'hips')::numeric,0)<=0 then raise exception 'Measurements are incomplete'; end if;
 end if;
 reference_key=coalesce(v->'measurements'->>'reference','');
 if v->>'measurementMethod'='reference' and reference_key='' then raise exception 'Upload a measurement chart'; end if;
 if reference_key<>'' and (
   reference_key !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
   or split_part(reference_key,'/',1)<>auth.uid()::text
   or split_part(reference_key,'/',2)<>r.id::text
   or not exists(select 1 from storage.objects where bucket_id='request-measurements' and name=reference_key)
 ) then raise exception 'Invalid measurement reference'; end if;
 update public.outfit_requests set status='submitted',submitted_at=now() where id=r.id;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload)
 values('outfit_request.submitted','outfit_request',r.id::text,jsonb_build_object('request_id',r.id));
 return r.id;
end; $$;
revoke all on function public.submit_outfit_request(uuid,integer) from public;
grant execute on function public.submit_outfit_request(uuid,integer) to authenticated;
