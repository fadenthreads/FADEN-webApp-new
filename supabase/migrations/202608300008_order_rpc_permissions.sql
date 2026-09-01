-- Supabase default privileges may explicitly grant anon EXECUTE independently of PUBLIC.
revoke all on function public.accept_boutique_offer(uuid,integer,boolean) from anon;
grant execute on function public.accept_boutique_offer(uuid,integer,boolean) to authenticated;
