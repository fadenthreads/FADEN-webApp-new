-- F03 storage foundations. Append-only buckets; existing request-inspiration/order-* buckets stay unchanged.
-- Object paths always include authenticated ownership identifiers. Service-role is never granted to clients.

create or replace function public.can_write_portfolio_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(object_name,'') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and split_part(object_name,'/',2)=auth.uid()::text
    and exists (
      select 1 from public.boutique_members m
      join public.boutiques b on b.id=m.boutique_id
      where m.user_id=auth.uid()
        and m.boutique_id::text=split_part(object_name,'/',1)
        and b.status not in ('suspended','rejected')
    );
$$;

create or replace function public.can_write_request_inspiration(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(object_name,'') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and split_part(object_name,'/',1)=auth.uid()::text
    and exists (
      select 1 from public.outfit_requests r
      where r.id::text=split_part(object_name,'/',2) and r.user_id=auth.uid()
    );
$$;

create or replace function public.can_read_request_inspiration(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write_request_inspiration(object_name)
    or (
      coalesce(object_name,'') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and exists (
        select 1 from public.request_shares s
        where s.revoked_at is null
          and s.include_inspiration
          and s.customer_id::text=split_part(object_name,'/',1)
          and s.request_id::text=split_part(object_name,'/',2)
          and public.owns_verified_atelier(s.boutique_id)
      )
    );
$$;

create or replace function public.can_write_order_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.customer_orders;
  purpose text;
  actor text;
begin
  if coalesce(object_name,'') !~ '^[0-9a-f-]{36}/(customer|atelier|shared)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$' then
    return false;
  end if;
  purpose=split_part(object_name,'/',2);
  actor=split_part(object_name,'/',3);
  if actor is distinct from auth.uid()::text then return false; end if;
  select * into o from public.customer_orders where id=split_part(object_name,'/',1)::uuid;
  if not found or o.status='cancelled' then return false; end if;
  if purpose='customer' then return o.customer_id=auth.uid(); end if;
  if purpose='atelier' then
    return o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id);
  end if;
  return o.customer_id=auth.uid()
    or (o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id));
end;
$$;

create or replace function public.can_read_order_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare o public.customer_orders;
begin
  if coalesce(object_name,'') !~ '^[0-9a-f-]{36}/(customer|atelier|shared)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$' then
    return false;
  end if;
  select * into o from public.customer_orders where id=split_part(object_name,'/',1)::uuid;
  if not found then return false; end if;
  if o.customer_id=auth.uid() then return true; end if;
  return o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id);
end;
$$;

create or replace function public.can_write_verification_document(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(object_name,'') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
    and split_part(object_name,'/',2)=auth.uid()::text
    and exists (
      select 1 from public.boutiques b
      where b.id::text=split_part(object_name,'/',1) and b.owner_id=auth.uid()
    );
$$;

create or replace function public.can_read_verification_document(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(object_name,'') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
    and (
      public.can_write_verification_document(object_name)
      or public.is_admin_aal2()
    );
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('portfolio-images','portfolio-images',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('request-inspirations','request-inspirations',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('order-files','order-files',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('verification-documents','verification-documents',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf']);

create policy portfolio_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id='portfolio-images');

create policy portfolio_images_member_insert on storage.objects
for insert to authenticated
with check (bucket_id='portfolio-images' and public.can_write_portfolio_image(name));

create policy portfolio_images_member_update on storage.objects
for update to authenticated
using (bucket_id='portfolio-images' and public.can_write_portfolio_image(name))
with check (bucket_id='portfolio-images' and public.can_write_portfolio_image(name));

create policy portfolio_images_member_delete on storage.objects
for delete to authenticated
using (bucket_id='portfolio-images' and public.can_write_portfolio_image(name));

create policy request_inspirations_owner_or_share_read on storage.objects
for select to authenticated
using (bucket_id='request-inspirations' and public.can_read_request_inspiration(name));

create policy request_inspirations_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id='request-inspirations' and public.can_write_request_inspiration(name));

create policy request_inspirations_owner_update on storage.objects
for update to authenticated
using (bucket_id='request-inspirations' and public.can_write_request_inspiration(name))
with check (bucket_id='request-inspirations' and public.can_write_request_inspiration(name));

create policy request_inspirations_owner_delete on storage.objects
for delete to authenticated
using (bucket_id='request-inspirations' and public.can_write_request_inspiration(name));

create policy order_files_party_read on storage.objects
for select to authenticated
using (bucket_id='order-files' and public.can_read_order_file(name));

create policy order_files_purpose_insert on storage.objects
for insert to authenticated
with check (bucket_id='order-files' and public.can_write_order_file(name));

create policy order_files_purpose_update on storage.objects
for update to authenticated
using (bucket_id='order-files' and public.can_write_order_file(name))
with check (bucket_id='order-files' and public.can_write_order_file(name));

create policy order_files_purpose_delete on storage.objects
for delete to authenticated
using (bucket_id='order-files' and public.can_write_order_file(name));

create policy verification_documents_owner_or_admin_read on storage.objects
for select to authenticated
using (bucket_id='verification-documents' and public.can_read_verification_document(name));

create policy verification_documents_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id='verification-documents' and public.can_write_verification_document(name));

create policy verification_documents_owner_delete on storage.objects
for delete to authenticated
using (bucket_id='verification-documents' and public.can_write_verification_document(name));

revoke all on function public.can_write_portfolio_image(text),
  public.can_write_request_inspiration(text),
  public.can_read_request_inspiration(text),
  public.can_write_order_file(text),
  public.can_read_order_file(text),
  public.can_write_verification_document(text),
  public.can_read_verification_document(text) from public, anon;
grant execute on function public.can_write_portfolio_image(text),
  public.can_write_request_inspiration(text),
  public.can_read_request_inspiration(text),
  public.can_write_order_file(text),
  public.can_read_order_file(text),
  public.can_write_verification_document(text),
  public.can_read_verification_document(text) to authenticated, service_role;

notify pgrst,'reload schema';
