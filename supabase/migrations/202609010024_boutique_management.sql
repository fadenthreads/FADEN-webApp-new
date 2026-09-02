-- A03 Boutique Management: list, search, filter, suspend, and restore RPCs.
-- Requires authenticated admin with AAL2.

-- ============================================================================
-- BOUTIQUE LIST RPC
-- ============================================================================

create or replace function public.admin_list_boutiques(
  p_search text default null,
  p_status text default null,
  p_sort_by text default 'created_desc',
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_limit constant integer := 100;
  v_actual_limit integer;
  v_results jsonb;
  v_cursor_timestamp timestamptz;
  v_cursor_id uuid;
  v_has_more boolean;
  v_total_fetched integer;
begin
  -- Authorization: require authenticated admin with AAL2
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  if p_status is not null and p_status not in ('draft','pending_verification','verified','suspended','rejected') then
    raise exception 'Invalid boutique status filter';
  end if;
  if p_sort_by not in ('created_desc','created_asc','updated_desc','updated_asc') then
    raise exception 'Invalid boutique sort';
  end if;
  if p_limit is not null and p_limit < 1 then
    raise exception 'Page size must be positive';
  end if;

  -- Validate and cap page size
  v_actual_limit := least(coalesce(p_limit, 20), v_max_limit);

  -- Parse cursor if provided (format: timestamp|id)
  if p_cursor is not null then
    declare
      v_parts text[];
    begin
      v_parts := string_to_array(p_cursor, '|');
      if array_length(v_parts, 1) = 2 then
        v_cursor_timestamp := v_parts[1]::timestamptz;
        v_cursor_id := v_parts[2]::uuid;
      else
        raise exception 'Invalid cursor format';
      end if;
    exception when others then
      raise exception 'Invalid cursor format';
    end;
  end if;

  -- Fetch limit + 1 rows to check for more results
  with all_results as (
    select
      b.id,
      b.name,
      b.slug,
      b.status,
      b.is_published,
      b.city,
      b.created_at,
      b.updated_at,
      p.display_name as owner_display_name,
      au.email as owner_email,
      case
        when b.status = 'suspended' then true
        when b.status = 'rejected' then true
        else false
      end as has_restrictions
    from public.boutiques b
    left join auth.users au on au.id = b.owner_id
    left join public.profiles p on p.id = b.owner_id
    where
      -- Search filter
      (
        p_search is null or
        b.name ilike '%' || p_search || '%' or
        b.slug ilike '%' || p_search || '%' or
        au.email ilike '%' || p_search || '%'
      )
      -- Status filter
      and (p_status is null or b.status = p_status::public.boutique_status)
      -- Cursor pagination
      and (
        p_cursor is null or
        (
          case
            when p_sort_by = 'created_desc' then 
              b.created_at < v_cursor_timestamp or 
              (b.created_at = v_cursor_timestamp and b.id > v_cursor_id)
            when p_sort_by = 'created_asc' then 
              b.created_at > v_cursor_timestamp or 
              (b.created_at = v_cursor_timestamp and b.id > v_cursor_id)
            when p_sort_by = 'updated_desc' then 
              b.updated_at < v_cursor_timestamp or 
              (b.updated_at = v_cursor_timestamp and b.id > v_cursor_id)
            when p_sort_by = 'updated_asc' then 
              b.updated_at > v_cursor_timestamp or 
              (b.updated_at = v_cursor_timestamp and b.id > v_cursor_id)
            else 
              b.created_at < v_cursor_timestamp or 
              (b.created_at = v_cursor_timestamp and b.id > v_cursor_id)
          end
        )
      )
    order by
      case when p_sort_by = 'created_desc' then b.created_at end desc,
      case when p_sort_by = 'created_asc' then b.created_at end asc,
      case when p_sort_by = 'updated_desc' then b.updated_at end desc,
      case when p_sort_by = 'updated_asc' then b.updated_at end asc,
      b.id asc
    limit v_actual_limit + 1
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ar.id,
          'name', ar.name,
          'slug', ar.slug,
          'status', ar.status,
          'is_published', ar.is_published,
          'city', ar.city,
          'created_at', ar.created_at,
          'updated_at', ar.updated_at,
          'owner_display_name', ar.owner_display_name,
          'owner_email', ar.owner_email,
          'has_restrictions', ar.has_restrictions
        )
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_results, v_total_fetched
  from all_results ar;

  -- Check if we have more results
  v_has_more := v_total_fetched > v_actual_limit;

  -- If we have more, remove the extra item
  if v_has_more then
    v_results := (
      select jsonb_agg(item)
      from (
        select item
        from jsonb_array_elements(v_results) with ordinality as t(item, idx)
        where idx <= v_actual_limit
      ) limited
    );
  end if;

  -- Build next cursor from last returned item
  return jsonb_build_object(
    'boutiques', coalesce(v_results, '[]'::jsonb),
    'has_more', v_has_more,
    'next_cursor', case
      when v_has_more and v_results is not null then
        (
          select
            case
              when p_sort_by in ('created_desc', 'created_asc') then
                (item->>'created_at') || '|' || (item->>'id')
              when p_sort_by in ('updated_desc', 'updated_asc') then
                (item->>'updated_at') || '|' || (item->>'id')
              else
                (item->>'created_at') || '|' || (item->>'id')
            end
          from jsonb_array_elements(v_results) with ordinality as t(item, idx)
          where idx = v_actual_limit
          limit 1
        )
      else null
    end,
    'limit', v_actual_limit
  );
end;
$$;

comment on function public.admin_list_boutiques is
'Returns paginated boutique list with search, filter, and sort for AAL2 admin. Supports cursor pagination.';

-- ============================================================================
-- BOUTIQUE SUSPEND RPC
-- ============================================================================

create or replace function public.admin_suspend_boutique(
  p_boutique_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boutique record;
  v_audit_id bigint;
begin
  -- Authorization: require authenticated admin with AAL2
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Validate reason
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Suspension reason is required';
  end if;
  if length(trim(p_reason)) > 1000 then
    raise exception 'Suspension reason is too long';
  end if;

  -- Lock row and fetch current boutique state
  select id, name, slug, status, is_published
  into v_boutique
  from public.boutiques
  where id = p_boutique_id
  for update;

  if not found then
    raise exception 'Boutique not found';
  end if;

  -- Reject if already suspended
  if v_boutique.status = 'suspended' then
    raise exception 'Boutique is already suspended';
  end if;

  -- Update boutique status and unpublish if needed
  update public.boutiques
  set
    status = 'suspended',
    is_published = false,
    updated_at = now()
  where id = p_boutique_id;

  -- Record audit event
  v_audit_id := public.append_audit_event(
    p_action := 'boutique.suspended',
    p_entity_type := 'boutique',
    p_entity_id := p_boutique_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'admin',
    p_before_json := jsonb_build_object(
      'status', v_boutique.status,
      'is_published', v_boutique.is_published
    ),
    p_after_json := jsonb_build_object(
      'status', 'suspended',
      'is_published', false
    ),
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'boutique_name', v_boutique.name,
      'boutique_slug', v_boutique.slug
    )
  );

  return jsonb_build_object(
    'success', true,
    'boutique_id', p_boutique_id,
    'audit_id', v_audit_id
  );
end;
$$;

comment on function public.admin_suspend_boutique is
'Suspends a boutique and unpublishes it. Requires AAL2 admin and a non-empty reason. Records audit event.';

-- ============================================================================
-- BOUTIQUE RESTORE RPC
-- ============================================================================

create or replace function public.admin_restore_boutique(
  p_boutique_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boutique record;
  v_target_status public.boutique_status;
  v_previous_status text;
  v_audit_id bigint;
begin
  -- Authorization: require authenticated admin with AAL2
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Validate reason
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Restoration reason is required';
  end if;
  if length(trim(p_reason)) > 1000 then
    raise exception 'Restoration reason is too long';
  end if;

  -- Lock row and fetch current boutique state
  select id, name, slug, status, is_published, owner_id
  into v_boutique
  from public.boutiques
  where id = p_boutique_id
  for update;

  if not found then
    raise exception 'Boutique not found';
  end if;

  -- Only allow restoring suspended boutiques
  if v_boutique.status != 'suspended' then
    raise exception 'Only suspended boutiques can be restored';
  end if;

  -- Recover the status recorded by the latest trusted suspension event. A
  -- previously verified boutique may remain verified, but is never republished.
  select before_json->>'status'
  into v_previous_status
  from public.audit_events
  where entity_type = 'boutique'
    and entity_id = p_boutique_id::text
    and action = 'boutique.suspended'
  order by created_at desc, id desc
  limit 1;

  v_target_status := case
    when v_previous_status in ('draft','pending_verification','verified')
      then v_previous_status::public.boutique_status
    else 'draft'::public.boutique_status
  end;

  -- Update boutique status to safe restored state
  -- Do NOT automatically publish or verify
  update public.boutiques
  set
    status = v_target_status,
    is_published = false,
    updated_at = now()
  where id = p_boutique_id;

  -- Record audit event
  v_audit_id := public.append_audit_event(
    p_action := 'boutique.restored',
    p_entity_type := 'boutique',
    p_entity_id := p_boutique_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'admin',
    p_before_json := jsonb_build_object(
      'status', 'suspended'
    ),
    p_after_json := jsonb_build_object(
      'status', v_target_status
    ),
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'boutique_name', v_boutique.name,
      'boutique_slug', v_boutique.slug
    )
  );

  return jsonb_build_object(
    'success', true,
    'boutique_id', p_boutique_id,
    'restored_status', v_target_status,
    'audit_id', v_audit_id
  );
end;
$$;

comment on function public.admin_restore_boutique is
'Restores a suspended boutique to a safe status (draft). Requires AAL2 admin and a non-empty reason. Never automatically publishes or verifies. Records audit event.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Revoke all permissions from public, anonymous, and authenticated roles
revoke all on function public.admin_list_boutiques(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.admin_suspend_boutique(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_restore_boutique(uuid, text) from public, anon, authenticated;

-- Grant execute only to authenticated (RPCs will enforce AAL2 internally)
grant execute on function public.admin_list_boutiques(text, text, text, text, integer) to authenticated;
grant execute on function public.admin_suspend_boutique(uuid, text) to authenticated;
grant execute on function public.admin_restore_boutique(uuid, text) to authenticated;

notify pgrst, 'reload schema';
