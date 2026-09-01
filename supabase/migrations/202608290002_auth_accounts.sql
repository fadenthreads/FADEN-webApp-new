create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 40),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text,
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'IN' check (char_length(country_code) = 2),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_addresses_one_default_idx
on public.user_addresses (user_id) where is_default;

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_transactional boolean not null default true,
  email_marketing boolean not null default false,
  sms_transactional boolean not null default true,
  whatsapp_updates boolean not null default false,
  locale text not null default 'en-IN',
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boutique_invitations (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'boutique_staff' check (role = 'boutique_staff'),
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (boutique_id, email)
);

create trigger user_addresses_set_updated_at before update on public.user_addresses
for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

insert into public.user_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

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
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create or replace function public.is_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.create_boutique_application(
  boutique_name text,
  boutique_slug text,
  boutique_city text,
  boutique_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_boutique_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(boutique_name)) not between 2 and 120 then
    raise exception 'Boutique name must contain 2 to 120 characters';
  end if;
  if boutique_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(boutique_slug) not between 3 and 60 then
    raise exception 'Boutique slug is invalid';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('customer', 'boutique_owner')
  ) then
    raise exception 'This account cannot create a boutique application';
  end if;
  if exists (select 1 from public.boutiques where owner_id = auth.uid()) then
    raise exception 'This account already owns a boutique';
  end if;

  insert into public.boutiques (owner_id, slug, name, city, description, status)
  values (
    auth.uid(),
    boutique_slug,
    trim(boutique_name),
    trim(boutique_city),
    nullif(trim(boutique_description), ''),
    'pending_verification'
  )
  returning id into new_boutique_id;

  insert into public.boutique_members (boutique_id, user_id, role)
  values (new_boutique_id, auth.uid(), 'boutique_owner');

  update public.profiles
  set role = 'boutique_owner'
  where id = auth.uid() and role in ('customer', 'boutique_owner');

  insert into public.audit_events (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'boutique.application.created', 'boutique', new_boutique_id::text);

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values (
    'boutique.application.created',
    'boutique',
    new_boutique_id::text,
    jsonb_build_object('boutique_id', new_boutique_id, 'owner_id', auth.uid())
  );

  return new_boutique_id;
end;
$$;

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role public.app_role,
  change_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;
  if nullif(trim(change_reason), '') is null then
    raise exception 'A reason is required';
  end if;

  update public.profiles set role = new_role where id = target_user_id;
  if not found then raise exception 'Profile not found'; end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, reason)
  values (auth.uid(), 'profile.role.changed', 'profile', target_user_id::text, trim(change_reason));
end;
$$;

revoke update on public.profiles from authenticated;
grant update (display_name, phone, avatar_url) on public.profiles to authenticated;
revoke all on function public.create_boutique_application(text, text, text, text) from public;
grant execute on function public.create_boutique_application(text, text, text, text) to authenticated;
revoke all on function public.admin_set_user_role(uuid, public.app_role, text) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role, text) to authenticated;

alter table public.user_addresses enable row level security;
alter table public.user_preferences enable row level security;
alter table public.boutique_invitations enable row level security;

create policy "addresses_manage_self" on public.user_addresses
for all to authenticated
using (user_id = auth.uid() or public.is_admin_aal2())
with check (user_id = auth.uid() or public.is_admin_aal2());

create policy "preferences_select_self" on public.user_preferences
for select to authenticated using (user_id = auth.uid() or public.is_admin_aal2());

create policy "preferences_update_self" on public.user_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "boutique_owners_manage_invitations" on public.boutique_invitations
for all to authenticated
using (
  invited_by = auth.uid()
  or public.is_admin_aal2()
)
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.boutiques
    where id = boutique_id and owner_id = auth.uid()
  )
);
