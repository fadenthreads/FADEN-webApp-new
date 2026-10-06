create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 255 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  category text not null check (category in ('general','boutique','press','privacy','technical')),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contact_inquiries_created_idx on public.contact_inquiries(created_at desc);
create index contact_inquiries_email_rate_idx on public.contact_inquiries(lower(email),created_at desc);
alter table public.contact_inquiries enable row level security;
revoke all on public.contact_inquiries from public, anon, authenticated;

create or replace function public.submit_contact_inquiry(
  p_name text,
  p_email text,
  p_category text,
  p_message text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare result uuid; clean_email text := lower(trim(p_email));
begin
  if char_length(trim(coalesce(p_name,''))) not between 2 and 100
    or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_category not in ('general','boutique','press','privacy','technical')
    or char_length(trim(coalesce(p_message,''))) not between 10 and 4000 then
    raise exception 'Invalid contact inquiry';
  end if;
  if (select count(*) from public.contact_inquiries where lower(email)=clean_email and created_at > now()-interval '1 hour') >= 3 then
    raise exception 'Please wait before sending another enquiry';
  end if;
  insert into public.contact_inquiries(name,email,category,message)
  values(trim(p_name),clean_email,p_category,trim(p_message)) returning id into result;
  return result;
end; $$;

create or replace function public.admin_list_contact_inquiries(
  p_status text default null,
  p_limit integer default 100
) returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(i) order by i.created_at desc)
    from (select * from public.contact_inquiries
      where p_status is null or status=p_status
      order by created_at desc limit least(greatest(p_limit,1),100)) i
  ),'[]'::jsonb);
end; $$;

create or replace function public.admin_update_contact_inquiry(
  p_id uuid,
  p_status text
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
  if p_status not in ('new','in_progress','resolved','closed') then raise exception 'Invalid contact status'; end if;
  update public.contact_inquiries set status=p_status,updated_at=now() where id=p_id;
  if not found then raise exception 'Contact inquiry not found'; end if;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'support.updated','contact_inquiry',p_id::text,jsonb_build_object('status',p_status));
end; $$;

revoke all on function public.submit_contact_inquiry(text,text,text,text), public.admin_list_contact_inquiries(text,integer), public.admin_update_contact_inquiry(uuid,text) from public;
grant execute on function public.submit_contact_inquiry(text,text,text,text) to anon, authenticated;
grant execute on function public.admin_list_contact_inquiries(text,integer), public.admin_update_contact_inquiry(uuid,text) to authenticated;
notify pgrst,'reload schema';
