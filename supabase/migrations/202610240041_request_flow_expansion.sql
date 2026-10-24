-- Expanded choices and garment-specific measurements; preserve ownership/concurrency checks.
create or replace function public.submit_outfit_request(request_id uuid, expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.outfit_requests; v jsonb; reference_key text; required_keys text[]; k text;
begin
 select * into r from public.outfit_requests where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status='submitted' then return r.id; end if;
 if r.version<>expected_version then raise exception 'Review your latest saved details before submitting'; end if;
 v=r.draft;
 if coalesce(v->>'occasion','') not in ('Wedding','Reception','Engagement','Festival','Sangeet','Mehendi','Haldi','Cocktail','Party','Birthday','Anniversary','Baby Shower','Graduation','Formal Event','Religious Ceremony','Casual Outing','Other')
 or coalesce(v->>'garment','') not in ('Lehenga','Saree','Dress','Suit','Sherwani','Blouse','Other')
 or coalesce(v->>'budget','') not in ('under_10k','10k_25k','25k_50k','50k_100k','100k_plus','custom')
 or coalesce(v->>'measurementMethod','') not in ('manual','reference','saved','boutique','video','home','later')
 or not coalesce((v->>'consent')::boolean,false)
 or (not coalesce((v->>'expert')::boolean,false) and coalesce(v->>'silhouette','')='')
 then raise exception 'Complete all required request details and confirm consent'; end if;
 if v->>'occasion'='Other' and length(trim(coalesce(v->>'otherOccasion','')))=0 then raise exception 'Tell us your occasion'; end if;
 if v->>'silhouette'='Custom Form' and not coalesce((v->>'expert')::boolean,false) and length(trim(coalesce(v->>'customSilhouette','')))=0 then raise exception 'Describe your custom silhouette'; end if;
 if v->>'neckline'='Custom / Other' and length(trim(coalesce(v->>'necklineNotes','')))=0 then raise exception 'Describe your neckline'; end if;
 if v->>'sleeves'='Custom / Other' and length(trim(coalesce(v->>'sleeveNotes','')))=0 then raise exception 'Describe your sleeves'; end if;
 if coalesce(v->>'deliveryDate','')='' or coalesce(v->>'eventDate','')='' then raise exception 'Dates are required'; end if;
 if (v->>'deliveryDate')::date<current_date or (v->>'eventDate')::date<(v->>'deliveryDate')::date then raise exception 'Check event and delivery dates'; end if;
 if v->>'measurementMethod' in ('manual','saved') then
   if not (jsonb_typeof(v->'measurements')='object') or coalesce(v->'measurements'->>'unit','') not in ('cm','in') then raise exception 'Measurements are required'; end if;
   required_keys=case v->>'garment' when 'Blouse' then array['chest'] when 'Saree' then array['chest','waist'] when 'Sherwani' then array['chest','waist'] else array['chest','waist','hips'] end;
   foreach k in array required_keys loop
     if coalesce(nullif(v->'measurements'->>k,'')::numeric,0)<=0 then raise exception 'Complete the required garment measurements'; end if;
   end loop;
 end if;
 foreach k in array array['chest','waist','hips','height','shoulder','sleeveLength','upperArm','armhole','garmentLength','skirtLength','inseam','neck'] loop
   if coalesce(v->'measurements'->>k,'')<>'' and ((v->'measurements'->>k)::numeric<=0 or (v->'measurements'->>k)::numeric>case when v->'measurements'->>'unit'='in' then 120 else 300 end) then raise exception 'Check measurement values and units'; end if;
 end loop;
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

create or replace function public.share_outfit_request(target_request uuid,target_boutique uuid,measurements_allowed boolean,inspiration_allowed boolean,confirmed boolean) returns uuid
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
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into snapshot from jsonb_each(r.draft)
 where key in ('occasion','otherOccasion','garment','notes','expert','colors','silhouette','customSilhouette','neckline','necklineNotes','sleeves','sleeveNotes','fabrics','measurementMethod','eventDate','deliveryDate','budget');
 if measurements_allowed then snapshot=snapshot||jsonb_build_object('measurements',r.draft->'measurements'); end if;
 if inspiration_allowed then snapshot=snapshot||jsonb_build_object('links',coalesce(r.draft->'links','[]'::jsonb),'inspirations',coalesce(r.draft->'inspirations','[]'::jsonb)); end if;
 select coalesce(nullif(display_name,''),'FADEN customer') into label from public.profiles where id=auth.uid();
 insert into public.request_shares(request_id,customer_id,boutique_id,client_label,brief,include_measurements,include_inspiration)
 values(r.id,auth.uid(),target_boutique,label,snapshot,measurements_allowed,inspiration_allowed) returning id into result;
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('request.shared','request_share',result::text,jsonb_build_object('share_id',result));
 return result;
end; $$;
revoke all on function public.share_outfit_request(uuid,uuid,boolean,boolean,boolean) from public;
grant execute on function public.share_outfit_request(uuid,uuid,boolean,boolean,boolean) to authenticated;
