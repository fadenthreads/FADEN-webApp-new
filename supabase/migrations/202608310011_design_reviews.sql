-- Design review is an explicit preview workflow, never a production/payment trigger.
create table public.order_design_reviews (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 revision integer not null check(revision between 1 and 20),
 title text not null check(length(btrim(title)) between 2 and 120),
 designer_note text not null check(length(btrim(designer_note)) between 10 and 3000),
 sketch_path text not null,
 fabric text not null check(length(fabric) between 1 and 200),
 detailing text not null check(length(detailing) between 1 and 200),
 inspiration text not null check(length(inspiration)<=200),
 status text not null default 'pending' check(status in ('pending','approved','changes_requested')),
 feedback text not null default '' check(length(feedback)<=2000),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(order_id,revision),
 check((status='pending' and reviewed_at is null and feedback='') or (status<>'pending' and reviewed_at is not null)),
 check(status<>'changes_requested' or length(btrim(feedback))>=10)
);
alter table public.order_design_reviews enable row level security;
revoke all on public.order_design_reviews from anon,authenticated;
grant select on public.order_design_reviews to authenticated;
grant select,insert,update,delete on public.order_design_reviews to service_role;
create policy design_review_order_read on public.order_design_reviews for select to authenticated
 using(exists(select 1 from public.customer_orders o where o.id=order_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-designs','order-designs',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy design_sketch_upload on storage.objects for insert to authenticated with check(
 bucket_id='order-designs' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and exists(select 1 from public.customer_orders o where o.id::text=split_part(name,'/',1)
   and o.status<>'cancelled' and o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id))
);
create policy design_sketch_read on storage.objects for select to authenticated using(
 bucket_id='order-designs' and exists(select 1 from public.customer_orders o
 where o.id::text=split_part(name,'/',1) and (
   (o.boutique_owner_id=auth.uid() and public.owns_verified_atelier(o.boutique_id)) or
   (o.customer_id=auth.uid() and exists(select 1 from public.order_design_reviews r where r.order_id=o.id and r.sketch_path=name))
 ))
);
-- Published assets have no user UPDATE/DELETE policy: prior versions remain intact.

create function public.publish_order_design(target_order uuid,expected_revision integer,proposal jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; previous public.order_design_reviews; result uuid; path text;
begin
 select * into o from public.customer_orders where id=target_order and boutique_owner_id=auth.uid() for update;
 if not found or not public.owns_verified_atelier(o.boutique_id) then raise exception 'Order not available'; end if;
 if o.status='cancelled' then raise exception 'Cancelled orders cannot be reviewed'; end if;
 if jsonb_typeof(proposal) is distinct from 'object' or expected_revision is null or expected_revision<0 then raise exception 'Invalid design proposal'; end if;
 if jsonb_typeof(proposal->'title') is distinct from 'string' or length(btrim(proposal->>'title')) not between 2 and 120
 or jsonb_typeof(proposal->'note') is distinct from 'string' or length(btrim(proposal->>'note')) not between 10 and 3000
 or jsonb_typeof(proposal->'fabric') is distinct from 'string' or length(btrim(proposal->>'fabric')) not between 1 and 200
 or jsonb_typeof(proposal->'detailing') is distinct from 'string' or length(btrim(proposal->>'detailing')) not between 1 and 200
 or jsonb_typeof(proposal->'inspiration') is distinct from 'string' or length(proposal->>'inspiration')>200
 or jsonb_typeof(proposal->'sketch_path') is distinct from 'string' then raise exception 'Complete the design details within the stated limits'; end if;
 path=proposal->>'sketch_path';
 if split_part(path,'/',1)<>o.id::text or not exists(select 1 from storage.objects where bucket_id='order-designs' and name=path) then raise exception 'Upload a sketch for this order first'; end if;
 select * into previous from public.order_design_reviews where order_id=o.id order by revision desc limit 1;
 if found and previous.revision=expected_revision+1 and previous.title=btrim(proposal->>'title')
 and previous.designer_note=btrim(proposal->>'note') and previous.sketch_path=path
 and previous.fabric=btrim(proposal->>'fabric') and previous.detailing=btrim(proposal->>'detailing')
 and previous.inspiration=proposal->>'inspiration' then return previous.id; end if;
 if coalesce(previous.revision,0)<>expected_revision then raise exception 'Design changed; reload before publishing'; end if;
 if previous.id is not null and previous.status<>'changes_requested' then raise exception 'Wait for customer changes before publishing another version'; end if;
 if expected_revision>=20 then raise exception 'Revision limit reached; contact support'; end if;
 insert into public.order_design_reviews(order_id,revision,title,designer_note,sketch_path,fabric,detailing,inspiration)
 values(o.id,expected_revision+1,btrim(proposal->>'title'),btrim(proposal->>'note'),path,btrim(proposal->>'fabric'),btrim(proposal->>'detailing'),proposal->>'inspiration') returning id into result;
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'design.published','order_design_review',result::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('design.published','order_design_review',result::text,jsonb_build_object('order_id',o.id,'review_id',result));
 return result;
end; $$;

create function public.decide_order_design(target_review uuid,decision text,customer_feedback text,confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare candidate public.order_design_reviews; r public.order_design_reviews; o public.customer_orders;
begin
 if confirmed is distinct from true then raise exception 'Confirm your design decision'; end if;
 if decision is null or decision not in ('approved','changes_requested') or customer_feedback is null or length(customer_feedback)>2000
 or (decision='changes_requested' and length(btrim(customer_feedback))<10) then raise exception 'Provide a valid decision and change details'; end if;
 select * into candidate from public.order_design_reviews where id=target_review;
 select * into o from public.customer_orders where id=candidate.order_id and customer_id=auth.uid() for update;
 if not found then raise exception 'Design not available'; end if;
 if o.status='cancelled' then raise exception 'Cancelled orders cannot be reviewed'; end if;
 select * into r from public.order_design_reviews where order_id=o.id order by revision desc limit 1 for update;
 if r.id<>target_review then raise exception 'A newer design is available; reload before deciding'; end if;
 if r.status=decision and r.feedback=btrim(customer_feedback) then return r.id; end if;
 if r.status<>'pending' then raise exception 'This decision is already recorded'; end if;
 update public.order_design_reviews set status=decision,feedback=btrim(customer_feedback),reviewed_at=now() where id=r.id;
 insert into public.audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'design.'||decision,'order_design_review',r.id::text);
 insert into public.outbox_events(event_type,aggregate_type,aggregate_id,payload) values('design.'||decision,'order_design_review',r.id::text,jsonb_build_object('order_id',o.id,'review_id',r.id));
 return r.id;
end; $$;
revoke all on function public.publish_order_design(uuid,integer,jsonb),public.decide_order_design(uuid,text,text,boolean) from public,anon;
grant execute on function public.publish_order_design(uuid,integer,jsonb),public.decide_order_design(uuid,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
