-- Every application needs a customer-profile row, including before approval.
create or replace function public.initialize_boutique_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.boutique_profiles(boutique_id) values(new.id) on conflict do nothing;
  return new;
end; $$;
revoke all on function public.initialize_boutique_profile() from public, anon, authenticated;
create trigger initialize_boutique_profile after insert on public.boutiques
for each row execute function public.initialize_boutique_profile();
insert into public.boutique_profiles(boutique_id)
select id from public.boutiques on conflict do nothing;

create or replace function public.save_boutique_storefront(p_boutique_id uuid, p_version timestamptz, p_details jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.boutiques; p public.boutique_profiles; hero text;
begin
  select * into b from public.boutiques where id=p_boutique_id and owner_id=auth.uid() for update;
  if not found or b.status not in ('pending_verification','verified') then raise exception 'Storefront is not editable'; end if;
  insert into public.boutique_profiles(boutique_id) values(b.id) on conflict do nothing;
  select * into p from public.boutique_profiles where boutique_id=b.id for update;
  if p.updated_at is distinct from p_version then raise exception 'Storefront changed; refresh before saving'; end if;
  if length(trim(coalesce(p_details->>'name',''))) not between 2 and 120
    or length(trim(coalesce(p_details->>'city',''))) not between 2 and 120
    or length(trim(coalesce(p_details->>'description',''))) not between 10 and 1000
    or length(trim(coalesce(p_details->>'story',''))) not between 40 and 5000
    or jsonb_typeof(p_details->'specialties') is distinct from 'array'
    or jsonb_typeof(p_details->'services') is distinct from 'array'
  then raise exception 'Check storefront details'; end if;
  if jsonb_array_length(p_details->'specialties') not between 1 and 10
    or jsonb_array_length(p_details->'services') not between 1 and 10
    or exists(select 1 from jsonb_array_elements(p_details->'specialties') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 2 and 60)
    or exists(select 1 from jsonb_array_elements(p_details->'services') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 2 and 60)
    or coalesce((p_details->>'yearsExperience')::integer,-1) not between 0 and 100
    or coalesce((p_details->>'responseHours')::integer,0) not between 1 and 720
    or coalesce((p_details->>'minimumPricePaise')::bigint,-1) not between 0 and 1000000000
    or coalesce((p_details->>'leadTimeMinWeeks')::integer,0) not between 1 and 104
    or coalesce((p_details->>'leadTimeMaxWeeks')::integer,0) not between (p_details->>'leadTimeMinWeeks')::integer and 104
  then raise exception 'Check storefront preferences'; end if;
  hero=case when p_details ? 'heroImage' then nullif(p_details->>'heroImage','') else p.hero_image_url end;
  if hero is distinct from p.hero_image_url and hero is not null and not exists (
    select 1 from public.designs where boutique_id=b.id and status='published' and primary_image_url=hero
  ) then raise exception 'Choose a published portfolio image as your cover'; end if;
  update public.boutique_profiles set
    story=trim(p_details->>'story'), hero_image_url=hero,
    specialties=array(select jsonb_array_elements_text(p_details->'specialties')),
    services=array(select jsonb_array_elements_text(p_details->'services')),
    years_experience=(p_details->>'yearsExperience')::integer,
    response_time_hours=(p_details->>'responseHours')::integer,
    minimum_price_paise=(p_details->>'minimumPricePaise')::bigint,
    next_available_date=nullif(p_details->>'nextAvailableDate','')::date,
    lead_time_min_weeks=(p_details->>'leadTimeMinWeeks')::integer,
    lead_time_max_weeks=(p_details->>'leadTimeMaxWeeks')::integer
  where boutique_id=b.id returning * into p;
  update public.boutiques set name=trim(p_details->>'name'),city=trim(p_details->>'city'),description=trim(p_details->>'description') where id=b.id;
  return jsonb_build_object('version',p.updated_at,'live',b.status='verified' and b.is_published);
end; $$;
revoke all on function public.save_boutique_storefront(uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.save_boutique_storefront(uuid,timestamptz,jsonb) to authenticated;
