-- An Admin approval is the launch publication gate. Pending, rejected and
-- suspended boutiques remain private; an approved verified boutique becomes
-- discoverable atomically with the approval transaction.

create or replace function public.publish_boutique_after_verification_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.boutiques
    set
      is_published = true,
      updated_at = now()
    where id = new.boutique_id
      and status = 'verified';
  end if;

  return new;
end;
$$;

revoke all on function public.publish_boutique_after_verification_approval() from public, anon, authenticated;

drop trigger if exists publish_boutique_on_verification_approval
  on public.boutique_verification_submissions;

create trigger publish_boutique_on_verification_approval
after update of status on public.boutique_verification_submissions
for each row
execute function public.publish_boutique_after_verification_approval();

-- Repair approvals made before the publication gate was added. Rejected,
-- suspended and draft boutiques are deliberately excluded.
update public.boutiques as b
set
  is_published = true,
  updated_at = now()
where b.status = 'verified'
  and b.is_published = false
  and exists (
    select 1
    from public.boutique_verification_submissions as s
    where s.boutique_id = b.id
      and s.status = 'approved'
  );

comment on function public.publish_boutique_after_verification_approval() is
'Publishes a verified boutique only when its submitted verification transitions to Admin-approved.';

comment on function public.admin_approve_verification(uuid, text) is
'Approves a submitted verification and atomically publishes the verified boutique. Records audit and outbox events. Requires AAL2 admin.';
