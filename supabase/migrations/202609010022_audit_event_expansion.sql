-- F05 audit-event expansion. Extends public.audit_events; append-only for API roles.

alter table public.audit_events
  add column if not exists actor_role public.app_role,
  add column if not exists before_json jsonb,
  add column if not exists after_json jsonb,
  add column if not exists request_id text,
  add column if not exists ip_hash text,
  add column if not exists user_agent_summary text;

alter table public.audit_events
  drop constraint if exists audit_events_action_len,
  add constraint audit_events_action_len check (char_length(action) between 1 and 120),
  drop constraint if exists audit_events_entity_type_len,
  add constraint audit_events_entity_type_len check (char_length(entity_type) between 1 and 80),
  drop constraint if exists audit_events_entity_id_len,
  add constraint audit_events_entity_id_len check (entity_id is null or char_length(entity_id) <= 128),
  drop constraint if exists audit_events_reason_len,
  add constraint audit_events_reason_len check (reason is null or char_length(reason) <= 500),
  drop constraint if exists audit_events_request_id_len,
  add constraint audit_events_request_id_len check (request_id is null or char_length(request_id) <= 64),
  drop constraint if exists audit_events_ip_hash_len,
  add constraint audit_events_ip_hash_len check (ip_hash is null or char_length(ip_hash) <= 128),
  drop constraint if exists audit_events_user_agent_summary_len,
  add constraint audit_events_user_agent_summary_len check (user_agent_summary is null or char_length(user_agent_summary) <= 120),
  drop constraint if exists audit_events_before_json_size,
  add constraint audit_events_before_json_size check (before_json is null or pg_column_size(before_json) <= 8192),
  drop constraint if exists audit_events_after_json_size,
  add constraint audit_events_after_json_size check (after_json is null or pg_column_size(after_json) <= 8192);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_action_idx on public.audit_events (action, created_at desc);
create index if not exists audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index if not exists audit_events_request_id_idx on public.audit_events (request_id)
where request_id is not null;

create or replace function public.sanitize_audit_json(input jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'id', 'status', 'role', 'action', 'type', 'version', 'reason',
    'boutique_id', 'order_id', 'user_id', 'entity_id', 'share_id', 'offer_id',
    'from_status', 'to_status', 'policy_basis', 'decision', 'slug', 'name',
    'subtotal_paise', 'tax_paise', 'total_paise', 'advance_paise', 'amount_paise',
    'currency', 'count', 'enabled', 'key', 'scope'
  ];
  blocked_pattern constant text := '(?i)(password|passwd|otp|token|secret|cookie|authorization|api[_-]?key|refresh[_-]?token|access[_-]?token|signed[_-]?url|card|cvv|pan|measurement|address|phone|email_body|provider_payload|razorpay|webhook_secret|bank_account|ifsc|account_number)';
  result jsonb := '{}'::jsonb;
  entry record;
  clean_key text;
  clean_value jsonb;
begin
  if input is null or input = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(input) <> 'object' then
    return null;
  end if;

  for entry in select key, value from jsonb_each(input) loop
    clean_key := lower(trim(entry.key));
    if clean_key = any(allowed_keys)
      and clean_key !~ blocked_pattern
      and char_length(clean_key) <= 64 then
      if jsonb_typeof(entry.value) in ('string', 'number', 'boolean', 'null') then
        if jsonb_typeof(entry.value) = 'string'
          and (entry.value #>> '{}') ~ blocked_pattern then
          continue;
        end if;
        if jsonb_typeof(entry.value) = 'string'
          and char_length(entry.value #>> '{}') > 256 then
          clean_value := to_jsonb(left(entry.value #>> '{}', 256));
        else
          clean_value := entry.value;
        end if;
        result := result || jsonb_build_object(clean_key, clean_value);
      end if;
    end if;
  end loop;

  if result = '{}'::jsonb then
    return null;
  end if;
  return result;
end;
$$;

create or replace function public.normalize_audit_request_id(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(regexp_replace(lower(coalesce(trim(input), '')), '[^a-z0-9-]', '', 'g'), 64), '');
$$;

create or replace function public.normalize_audit_user_agent(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(regexp_replace(coalesce(trim(input), ''), '\s+', ' ', 'g'), 120), '');
$$;

create or replace function public.append_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_actor_id uuid default auth.uid(),
  p_actor_role public.app_role default null,
  p_reason text default null,
  p_before_json jsonb default null,
  p_after_json jsonb default null,
  p_request_id text default null,
  p_ip_hash text default null,
  p_user_agent_summary text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_role public.app_role;
  v_reason text;
  v_metadata jsonb;
begin
  if nullif(trim(p_action), '') is null then
    raise exception 'Audit action is required';
  end if;
  if nullif(trim(p_entity_type), '') is null then
    raise exception 'Audit entity type is required';
  end if;

  v_reason := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if p_actor_role is null and p_actor_id is not null then
    select role into v_role from public.profiles where id = p_actor_id;
  else
    v_role := p_actor_role;
  end if;

  insert into public.audit_events (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    before_json,
    after_json,
    request_id,
    ip_hash,
    user_agent_summary,
    metadata
  )
  values (
    p_actor_id,
    v_role,
    left(trim(p_action), 120),
    left(trim(p_entity_type), 80),
    nullif(left(trim(coalesce(p_entity_id, '')), 128), ''),
    v_reason,
    public.sanitize_audit_json(p_before_json),
    public.sanitize_audit_json(p_after_json),
    public.normalize_audit_request_id(p_request_id),
    nullif(left(trim(coalesce(p_ip_hash, '')), 128), ''),
    public.normalize_audit_user_agent(p_user_agent_summary),
    v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.append_audit_event(
  text, text, text, uuid, public.app_role, text, jsonb, jsonb, text, text, text, jsonb
) from public, anon, authenticated;

create or replace function public.record_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_request_id text default null,
  p_ip_hash text default null,
  p_user_agent_summary text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  platform_actions constant text[] := array[
    'profile.role.changed',
    'boutique.status.changed',
    'boutique.verification.decision',
    'refund.initiated',
    'refund.completed',
    'dispute.opened',
    'dispute.updated',
    'dispute.resolved',
    'platform.config.changed',
    'payout.marked',
    'settlement.created',
    'membership.changed',
    'audit.exported'
  ];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  if not (p_action = any(platform_actions)) then
    raise exception 'Unsupported platform audit action';
  end if;

  return public.append_audit_event(
    p_action := p_action,
    p_entity_type := p_entity_type,
    p_entity_id := p_entity_id,
    p_actor_id := auth.uid(),
    p_reason := p_reason,
    p_before_json := p_before,
    p_after_json := p_after,
    p_request_id := p_request_id,
    p_ip_hash := p_ip_hash,
    p_user_agent_summary := p_user_agent_summary
  );
end;
$$;

revoke all on function public.record_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) from public, anon;
grant execute on function public.record_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) to authenticated;

create or replace function public.audit_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return coalesce(new, old);
  end if;
  raise exception 'Audit events are append-only';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
before update on public.audit_events
for each row execute function public.audit_events_immutable();

drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_delete
before delete on public.audit_events
for each row execute function public.audit_events_immutable();

grant select on public.audit_events to authenticated;

drop policy if exists "audit_events_select_aal2_admin" on public.audit_events;
create policy "audit_events_select_aal2_admin" on public.audit_events
for select to authenticated
using (public.is_admin_aal2());

-- Trusted functions write through append_audit_event.
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
declare
  old_role public.app_role;
begin
  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;
  if nullif(trim(change_reason), '') is null then
    raise exception 'A reason is required';
  end if;

  select role into old_role from public.profiles where id = target_user_id;
  if not found then raise exception 'Profile not found'; end if;

  update public.profiles set role = new_role where id = target_user_id;

  perform public.append_audit_event(
    p_action := 'profile.role.changed',
    p_entity_type := 'profile',
    p_entity_id := target_user_id::text,
    p_actor_id := auth.uid(),
    p_reason := trim(change_reason),
    p_before_json := jsonb_build_object('role', old_role),
    p_after_json := jsonb_build_object('role', new_role)
  );
end;
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

  perform public.append_audit_event(
    p_action := 'boutique.application.created',
    p_entity_type := 'boutique',
    p_entity_id := new_boutique_id::text,
    p_actor_id := auth.uid(),
    p_after_json := jsonb_build_object(
      'status', 'pending_verification',
      'slug', boutique_slug,
      'name', left(trim(boutique_name), 120)
    )
  );

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

revoke all on function public.admin_set_user_role(uuid, public.app_role, text) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role, text) to authenticated;
revoke all on function public.create_boutique_application(text, text, text, text) from public;
grant execute on function public.create_boutique_application(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
