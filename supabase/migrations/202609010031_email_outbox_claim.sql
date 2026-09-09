-- A server-side worker claims events atomically; browser roles never receive
-- permission to inspect or mutate operational email state.
create function public.claim_email_outbox(p_limit integer default 20) returns setof public.outbox_events
language plpgsql security definer set search_path='' as $$
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid outbox batch size'; end if;
 return query
 with claimed as (
   select id from public.outbox_events
   where status in ('pending','failed') and available_at<=now() and attempts<5
   order by available_at,id for update skip locked limit p_limit
 ) update public.outbox_events e set status='processing',attempts=e.attempts+1,last_error=null
 from claimed where e.id=claimed.id returning e.*;
end; $$;

create function public.complete_email_outbox(p_id bigint,p_delivered boolean,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.outbox_events set status=case when p_delivered then 'completed' when attempts>=5 then 'failed' else 'pending' end,
 processed_at=case when p_delivered then now() else processed_at end,
 available_at=case when p_delivered or attempts>=5 then available_at else now() + make_interval(mins => attempts*5) end,
 last_error=case when p_delivered then null else left(coalesce(p_error,'delivery failed'),240) end
 where id=p_id and status='processing';
 if not found then raise exception 'Outbox item is not claimed'; end if;
end; $$;
revoke all on function public.claim_email_outbox(integer),public.complete_email_outbox(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_email_outbox(integer),public.complete_email_outbox(bigint,boolean,text) to service_role;
notify pgrst,'reload schema';
