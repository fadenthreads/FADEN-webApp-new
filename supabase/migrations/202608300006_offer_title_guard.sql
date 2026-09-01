-- Direct authenticated RPC calls must preserve the same nonblank title contract as the API.
alter table public.boutique_offers add constraint offer_title_nonblank
check(length(btrim(coalesce(quote->>'title',''))) between 1 and 160);
create index boutique_offers_customer_idx on public.boutique_offers(customer_id,sent_at desc);
