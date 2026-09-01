create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'boutique_owner', 'boutique_staff', 'admin');
create type public.boutique_status as enum ('draft', 'pending_verification', 'verified', 'suspended', 'rejected');
create type public.job_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boutiques (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  city text,
  status public.boutique_status not null default 'draft',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boutique_members (
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'boutique_staff',
  created_at timestamptz not null default now(),
  primary key (boutique_id, user_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.outbox_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_events_ready_idx on public.outbox_events (status, available_at)
where status in ('pending', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger boutiques_set_updated_at before update on public.boutiques
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.phone,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.boutiques enable row level security;
alter table public.boutique_members enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;

revoke all on public.audit_events from anon, authenticated;
revoke all on public.outbox_events from anon, authenticated;

create policy "profiles_select_self" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "published_boutiques_are_public" on public.boutiques
for select to anon, authenticated using (
  is_published = true or owner_id = auth.uid() or public.is_admin()
);

create policy "owners_create_boutiques" on public.boutiques
for insert to authenticated with check (owner_id = auth.uid());

create policy "owners_update_boutiques" on public.boutiques
for update to authenticated using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "members_read_membership" on public.boutique_members
for select to authenticated using (user_id = auth.uid() or public.is_admin());

