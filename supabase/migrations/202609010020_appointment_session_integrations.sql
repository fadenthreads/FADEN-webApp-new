-- Provider-ready metadata only. Live room creation remains disabled by environment flags.
create table public.appointment_session_integrations (
 appointment_id uuid primary key references public.measurement_appointments(id) on delete cascade,
 provider text not null check(provider in ('daily','in_person')),
 provider_room_name text check(length(provider_room_name)<=128),
 provider_room_url text check(length(provider_room_url)<=2048),
 state text not null default 'pending' check(state in ('pending','ready','expired','revoked','failed')),
 venue_snapshot jsonb,
 latitude numeric(9,6),
 longitude numeric(9,6),
 arrival_instructions text check(length(arrival_instructions)<=500),
 provisioned_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(
   (provider='daily' and venue_snapshot is null and latitude is null and longitude is null)
   or
   (provider='in_person' and provider_room_name is null and provider_room_url is null)
 ),
 check(latitude is null or latitude between -90 and 90),
 check(longitude is null or longitude between -180 and 180)
);

alter table public.appointment_session_integrations enable row level security;
revoke all on public.appointment_session_integrations from anon,authenticated;
grant all on public.appointment_session_integrations to service_role;

-- Room URLs are intentionally server-only. Authenticated participants receive a
-- short-lived join token from a protected application route when live rooms are enabled.
notify pgrst,'reload schema';
