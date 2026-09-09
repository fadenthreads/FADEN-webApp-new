-- AAL2 administrators may see operational delivery failures, but never an
-- email address, event payload, or provider response.
create function public.admin_email_delivery_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin_aal2() then
    raise exception 'Administrator MFA is required';
  end if;

  select jsonb_build_object(
    'pending_count', count(*) filter (where status in ('pending', 'processing')),
    'failed_count', count(*) filter (where status = 'failed'),
    'failed_events', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'event_type', event_type,
          'attempts', attempts,
          'created_at', created_at,
          'last_error', coalesce(last_error, 'delivery failed')
        ) order by created_at desc
      ) filter (where status = 'failed'),
      '[]'::jsonb
    )
  ) into result
  from (
    select * from public.outbox_events
    order by created_at desc
    limit 50
  ) recent;

  return result;
end;
$$;

revoke all on function public.admin_email_delivery_summary() from public, anon, authenticated;
grant execute on function public.admin_email_delivery_summary() to authenticated;
notify pgrst, 'reload schema';
