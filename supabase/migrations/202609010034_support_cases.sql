create table public.support_cases (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.customer_orders(id) on delete restrict,
 customer_id uuid not null references public.profiles(id), kind text not null check(kind in ('help','cancellation','refund')),
 status text not null default 'open' check(status in ('open','awaiting_customer','awaiting_boutique','resolved','closed')),
 subject text not null check(char_length(subject) between 3 and 120), version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);
create unique index support_cases_one_active_per_order on public.support_cases(order_id) where status not in ('resolved','closed');
create table public.support_case_messages (
 id bigint generated always as identity primary key, case_id uuid not null references public.support_cases(id) on delete cascade,
 author_id uuid not null references public.profiles(id), body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.support_case_admin_notes (
 id bigint generated always as identity primary key, case_id uuid not null references public.support_cases(id) on delete cascade,
 admin_id uuid not null references public.profiles(id), body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;
alter table public.support_case_admin_notes enable row level security;
revoke all on public.support_cases, public.support_case_messages, public.support_case_admin_notes from public, anon, authenticated;
create function public.customer_open_support_case(p_order_id uuid,p_kind text,p_subject text,p_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.support_cases;
begin
 if p_kind not in ('help','cancellation','refund') then raise exception 'Invalid support request'; end if;
 if p_subject is null or char_length(trim(p_subject)) not between 3 and 120 or p_message is null or char_length(trim(p_message)) not between 1 and 4000 then raise exception 'Support message is invalid'; end if;
 if not exists(select 1 from public.customer_orders where id=p_order_id and customer_id=auth.uid()) then raise exception 'Order not found'; end if;
 select * into c from public.support_cases where order_id=p_order_id and status not in ('resolved','closed') for update;
 if found then return c.id; end if;
 insert into public.support_cases(order_id,customer_id,kind,subject) values(p_order_id,auth.uid(),p_kind,trim(p_subject)) returning * into c;
 insert into public.support_case_messages(case_id,author_id,body) values(c.id,auth.uid(),trim(p_message));
 insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'support.opened','support_case',c.id::text,jsonb_build_object('order_id',p_order_id,'kind',p_kind));
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('support.opened','customer_order',p_order_id::text,jsonb_build_object('order_id',p_order_id,'case_id',c.id)); return c.id;
end; $$;
create function public.customer_read_support_case(p_case_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.support_cases;
begin
 select * into c from public.support_cases where id=p_case_id and customer_id=auth.uid(); if not found then raise exception 'Support case not found'; end if;
 return jsonb_build_object('case',jsonb_build_object('id',c.id,'order_id',c.order_id,'kind',c.kind,'status',c.status,'subject',c.subject,'created_at',c.created_at),'messages',coalesce((select jsonb_agg(jsonb_build_object('body',body,'created_at',created_at) order by created_at) from public.support_case_messages where case_id=c.id),'[]'::jsonb));
end; $$;
create function public.admin_read_order_support_cases(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'status',status,'subject',subject,'created_at',created_at) order by created_at desc) from public.support_cases where order_id=p_order_id),'[]'::jsonb);
end; $$;
create function public.admin_update_support_case(p_case_id uuid,p_status text,p_note text default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.support_cases;
begin
 if not public.is_admin_aal2() then raise exception 'Administrator MFA is required'; end if;
 if p_status not in ('open','awaiting_customer','awaiting_boutique','resolved','closed') then raise exception 'Invalid support status'; end if;
 select * into c from public.support_cases where id=p_case_id for update; if not found then raise exception 'Support case not found'; end if;
 update public.support_cases set status=p_status,version=version+1,updated_at=now(),closed_at=case when p_status in ('resolved','closed') then now() else null end where id=c.id;
 if p_note is not null and char_length(trim(p_note)) between 1 and 4000 then insert into public.support_case_admin_notes(case_id,admin_id,body) values(c.id,auth.uid(),trim(p_note)); end if;
 insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'support.updated','support_case',c.id::text,jsonb_build_object('order_id',c.order_id,'status',p_status));
end; $$;
revoke all on function public.customer_open_support_case(uuid,text,text,text), public.customer_read_support_case(uuid), public.admin_read_order_support_cases(uuid), public.admin_update_support_case(uuid,text,text) from public, anon;
grant execute on function public.customer_open_support_case(uuid,text,text,text), public.customer_read_support_case(uuid) to authenticated;
grant execute on function public.admin_read_order_support_cases(uuid), public.admin_update_support_case(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
