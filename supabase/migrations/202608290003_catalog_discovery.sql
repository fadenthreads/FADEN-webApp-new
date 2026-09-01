create type public.catalog_status as enum ('draft', 'published', 'archived');

create table public.boutique_profiles (
  boutique_id uuid primary key references public.boutiques(id) on delete cascade,
  logo_url text,
  hero_image_url text,
  story_image_url text,
  story text,
  specialties text[] not null default '{}',
  services text[] not null default '{}',
  years_experience integer check (years_experience between 0 and 100),
  response_time_hours integer check (response_time_hours between 1 and 720),
  next_available_date date,
  minimum_price_paise bigint check (minimum_price_paise >= 0),
  lead_time_min_weeks integer check (lead_time_min_weeks > 0),
  lead_time_max_weeks integer check (lead_time_max_weeks >= lead_time_min_weeks),
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  status public.catalog_status not null default 'draft',
  base_price_paise bigint not null check (base_price_paise >= 0),
  currency text not null default 'INR' check (char_length(currency) = 3),
  lead_time_min_weeks integer not null check (lead_time_min_weeks > 0),
  lead_time_max_weeks integer not null check (lead_time_max_weeks >= lead_time_min_weeks),
  primary_image_url text not null,
  gallery_image_urls text[] not null default '{}',
  occasions text[] not null default '{}',
  materials text[] not null default '{}',
  techniques text[] not null default '{}',
  customizable_elements text[] not null default '{}',
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_boutiques (
  user_id uuid not null references public.profiles(id) on delete cascade,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, boutique_id)
);

create table public.saved_designs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  design_id uuid not null references public.designs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, design_id)
);

create index designs_published_idx on public.designs (published_at desc)
where status = 'published';
create index designs_boutique_idx on public.designs (boutique_id, status);
create index designs_occasions_gin_idx on public.designs using gin (occasions);
create index designs_materials_gin_idx on public.designs using gin (materials);
create index designs_tags_gin_idx on public.designs using gin (tags);
create index boutiques_city_idx on public.boutiques (city) where is_published;

create trigger boutique_profiles_set_updated_at before update on public.boutique_profiles
for each row execute function public.set_updated_at();

create trigger designs_set_updated_at before update on public.designs
for each row execute function public.set_updated_at();

create or replace function public.is_boutique_member(target_boutique_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boutique_members
    where boutique_id = target_boutique_id and user_id = auth.uid()
  );
$$;

alter table public.boutique_profiles enable row level security;
alter table public.designs enable row level security;
alter table public.saved_boutiques enable row level security;
alter table public.saved_designs enable row level security;

create policy "published_boutique_profiles_are_public" on public.boutique_profiles
for select to anon, authenticated using (
  exists (
    select 1 from public.boutiques
    where id = boutique_id and is_published = true and status = 'verified'
  )
  or public.is_boutique_member(boutique_id)
  or public.is_admin_aal2()
);

create policy "members_manage_boutique_profile" on public.boutique_profiles
for all to authenticated
using (public.is_boutique_member(boutique_id) or public.is_admin_aal2())
with check (public.is_boutique_member(boutique_id) or public.is_admin_aal2());

create policy "published_designs_are_public" on public.designs
for select to anon, authenticated using (
  (
    status = 'published'
    and exists (
      select 1 from public.boutiques
      where id = boutique_id and is_published = true and status = 'verified'
    )
  )
  or public.is_boutique_member(boutique_id)
  or public.is_admin_aal2()
);

create policy "members_create_designs" on public.designs
for insert to authenticated
with check (public.is_boutique_member(boutique_id));

create policy "members_update_designs" on public.designs
for update to authenticated
using (public.is_boutique_member(boutique_id) or public.is_admin_aal2())
with check (public.is_boutique_member(boutique_id) or public.is_admin_aal2());

create policy "members_delete_designs" on public.designs
for delete to authenticated
using (public.is_boutique_member(boutique_id) or public.is_admin_aal2());

create policy "customers_manage_saved_boutiques" on public.saved_boutiques
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "customers_manage_saved_designs" on public.saved_designs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
