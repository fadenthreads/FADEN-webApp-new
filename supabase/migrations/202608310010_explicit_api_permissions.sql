-- Work with automatic Data API grants disabled. RLS remains the row boundary.
grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles, public.boutiques, public.boutique_members,
  public.user_addresses, public.user_preferences, public.boutique_invitations,
  public.boutique_profiles, public.designs, public.saved_boutiques,
  public.saved_designs from anon, authenticated;

grant select on public.profiles, public.boutique_members to authenticated;
grant update(display_name, phone, avatar_url) on public.profiles to authenticated;
-- Creation goes through create_boutique_application; verification is privileged.
grant select on public.boutiques, public.boutique_profiles, public.designs to anon, authenticated;
grant select, insert, update, delete on public.user_addresses to authenticated;
grant select, update on public.user_preferences to authenticated;
grant select, insert, delete on public.saved_boutiques, public.saved_designs to authenticated;
-- Invitation/profile administration is not exposed until a validated workflow exists.
grant select on public.boutique_invitations to authenticated;
grant insert(boutique_id, slug, title, description, status, base_price_paise,
  currency, lead_time_min_weeks, lead_time_max_weeks, primary_image_url,
  gallery_image_urls, occasions, materials, techniques, customizable_elements,
  tags, published_at) on public.designs to authenticated;
grant update(slug, title, description, status, base_price_paise,
  currency, lead_time_min_weeks, lead_time_max_weeks, primary_image_url,
  gallery_image_urls, occasions, materials, techniques, customizable_elements,
  tags, published_at) on public.designs to authenticated;
grant delete on public.designs to authenticated;

-- BYPASSRLS does not replace table privileges when automatic grants are off.
grant select, insert, update, delete on public.profiles, public.boutiques,
  public.boutique_members, public.audit_events, public.outbox_events,
  public.user_addresses, public.user_preferences, public.boutique_invitations,
  public.boutique_profiles, public.designs, public.saved_boutiques,
  public.saved_designs, public.outfit_requests, public.measurement_profiles,
  public.request_shares, public.boutique_offers, public.atelier_request_notes,
  public.customer_orders, public.order_payment_attempts to service_role;
grant usage, select on sequence public.audit_events_id_seq,
  public.outbox_events_id_seq to service_role;

-- Do not inherit PUBLIC or platform-specific anonymous RPC permissions.
revoke execute on function public.create_boutique_application(text,text,text,text),
  public.admin_set_user_role(uuid,public.app_role,text),
  public.submit_outfit_request(uuid,integer),
  public.owns_verified_atelier(uuid),
  public.share_outfit_request(uuid,uuid,boolean,boolean,boolean),
  public.save_boutique_offer(uuid,integer,jsonb,boolean),
  public.revoke_request_share(uuid),
  public.close_boutique_offer(uuid,integer,text) from public, anon;
grant execute on function public.create_boutique_application(text,text,text,text),
  public.admin_set_user_role(uuid,public.app_role,text),
  public.submit_outfit_request(uuid,integer),
  public.owns_verified_atelier(uuid),
  public.share_outfit_request(uuid,uuid,boolean,boolean,boolean),
  public.save_boutique_offer(uuid,integer,jsonb,boolean),
  public.revoke_request_share(uuid),
  public.close_boutique_offer(uuid,integer,text) to authenticated;

-- These helpers are used by anonymous catalog RLS as well as signed-in policies.
revoke execute on function public.is_admin(), public.is_admin_aal2(),
  public.is_boutique_member(uuid) from public;
grant execute on function public.is_admin(), public.is_admin_aal2(),
  public.is_boutique_member(uuid) to anon, authenticated, service_role;
revoke execute on function public.handle_new_user(), public.set_updated_at(),
  public.version_outfit_request() from public, anon, authenticated;

notify pgrst, 'reload schema';
