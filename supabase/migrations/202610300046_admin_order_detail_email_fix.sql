-- Match admin_list_orders: email belongs to auth.users, not public.profiles.
-- Preserve the existing AAL2 gate, projection and address-access boundary.
create or replace function public.admin_read_order_detail(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if not exists(select 1 from public.customer_orders where id=p_order_id) then raise exception 'Order not found'; end if;
 select jsonb_build_object(
   'order',(select to_jsonb(o) - 'customer_id' - 'boutique_owner_id' from public.customer_orders o where o.id=p_order_id),
   'customer',(select jsonb_build_object('email',u.email,'display_name',p.display_name) from public.customer_orders o join public.profiles p on p.id=o.customer_id join auth.users u on u.id=p.id where o.id=p_order_id),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'amount_paise',amount_paise,'currency',currency,'status',status,'mode',mode,'created_at',created_at,'verified_at',verified_at)) from public.order_payment_attempts where order_id=p_order_id),'[]'::jsonb),
   'shipment',(select jsonb_build_object('id',id,'carrier_name',carrier_name,'tracking_number',tracking_number,'tracking_url',tracking_url,'status',status,'admin_note',admin_note,'shipped_at',shipped_at,'delivered_at',delivered_at,'version',version,'updated_at',updated_at) from public.manual_order_shipments where order_id=p_order_id),
   'fulfilment',(select jsonb_build_object('claimed_by',claimed_by,'claimed_at',claimed_at,'version',version) from public.admin_order_fulfilment where order_id=p_order_id),
   'notes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by created_at desc) from public.admin_order_notes where order_id=p_order_id),'[]'::jsonb),
   'production',coalesce((select jsonb_agg(jsonb_build_object('stage',stage,'note',note,'created_at',created_at) order by sequence) from public.order_production_updates where order_id=p_order_id),'[]'::jsonb),
   'design_reviews',coalesce((select jsonb_agg(jsonb_build_object('status',status,'title',title,'created_at',created_at,'reviewed_at',reviewed_at) order by revision) from public.order_design_reviews where order_id=p_order_id),'[]'::jsonb),
   'appointments',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'status',status,'starts_at',starts_at,'ends_at',ends_at) order by starts_at desc) from public.measurement_appointments where order_id=p_order_id),'[]'::jsonb),
   'address_available',exists(select 1 from public.order_delivery_details where order_id=p_order_id),
   'timeline',coalesce((select jsonb_agg(jsonb_build_object('status',status,'created_at',created_at) order by created_at) from public.manual_shipment_events where order_id=p_order_id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
revoke all on function public.admin_read_order_detail(uuid) from public, anon;
grant execute on function public.admin_read_order_detail(uuid) to authenticated;
