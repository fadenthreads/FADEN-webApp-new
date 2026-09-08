create or replace function public.admin_list_orders(
  p_search text default null, p_queue text default null, p_order_status text default null,
  p_payment_status text default null, p_shipment_status text default null,
  p_cursor timestamptz default null, p_cursor_id uuid default null, p_limit integer default 20
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_limit integer := greatest(1, least(coalesce(p_limit,20),50));
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if p_queue is not null and p_queue <> 'shipping' then raise exception 'Invalid queue'; end if;
 with rows as (
   select o.id,o.boutique_name,o.status as order_status,o.total_paise,o.currency,o.accepted_at,u.email as customer_email,
     coalesce(p.status,'unpaid') as payment_status,s.status as shipment_status,f.claimed_by,f.version as fulfilment_version,public.admin_order_captured(o.id) as captured
   from public.customer_orders o join auth.users u on u.id=o.customer_id
   left join public.order_payment_attempts p on p.order_id=o.id left join public.manual_order_shipments s on s.order_id=o.id left join public.admin_order_fulfilment f on f.order_id=o.id
   where (p_search is null or o.id::text ilike '%'||left(trim(p_search),120)||'%' or u.email ilike '%'||left(trim(p_search),120)||'%' or o.boutique_name ilike '%'||left(trim(p_search),120)||'%')
     and (p_queue is distinct from 'shipping' or public.admin_order_captured(o.id)) and (p_order_status is null or o.status=p_order_status) and (p_payment_status is null or coalesce(p.status,'unpaid')=p_payment_status) and (p_shipment_status is null or coalesce(s.status,'awaiting_arrangement')=p_shipment_status)
     and (p_cursor is null or (o.accepted_at,o.id) < (p_cursor,coalesce(p_cursor_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by o.accepted_at desc,o.id desc limit v_limit+1
 ), page as (select * from rows limit v_limit)
 select jsonb_build_object('orders',coalesce((select jsonb_agg(to_jsonb(page) order by accepted_at desc,id desc) from page),'[]'::jsonb),'has_more',(select count(*)>v_limit from rows),'next_cursor',case when (select count(*)>v_limit from rows) then (select accepted_at from page order by accepted_at asc,id asc limit 1) end,'next_cursor_id',case when (select count(*)>v_limit from rows) then (select id from page order by accepted_at asc,id asc limit 1) end) into v_result;
 return v_result;
end; $$;
revoke all on function public.admin_list_orders(text,text,text,text,text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.admin_list_orders(text,text,text,text,text,timestamptz,uuid,integer) to authenticated;
notify pgrst,'reload schema';
