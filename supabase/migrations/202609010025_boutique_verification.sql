-- A04 Boutique Verification: complete verification workflow for boutique owners and AAL2 admins.
-- Owner workflow: draft, upload documents, submit.
-- Admin workflow: review, approve, request changes, reject.
-- All decisions atomic with boutique status, verification events, audit events, and outbox events.

-- ============================================================================
-- TABLE: boutique_verification_submissions
-- ============================================================================

create table if not exists public.boutique_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  submitting_owner_id uuid not null references public.profiles(id),
  
  -- Legal and business details
  legal_business_name text not null,
  public_trading_name text,
  business_type text not null check (length(business_type) <= 100),
  registration_number text not null check (length(registration_number) <= 50),
  gstin text check (length(gstin) <= 15),
  pan text not null check (length(pan) <= 10),
  
  -- Address
  registered_address_line1 text not null check (length(registered_address_line1) <= 200),
  registered_address_line2 text check (length(registered_address_line2) <= 200),
  city text not null check (length(city) <= 100),
  state text not null check (length(state) <= 100),
  postal_code text not null check (length(postal_code) <= 10),
  country text not null default 'IN' check (country = 'IN'),
  
  -- Authorized representative
  authorized_rep_name text not null check (length(authorized_rep_name) <= 200),
  authorized_rep_role text not null check (length(authorized_rep_role) <= 100),
  contact_email text not null check (length(contact_email) <= 255),
  contact_phone text not null check (length(contact_phone) <= 20),
  
  -- Workflow state
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','rejected')),
  declaration_version text not null default '2024-01',
  
  -- Submission metadata
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewing_admin_id uuid references public.profiles(id),
  admin_decision_reason text check (length(admin_decision_reason) <= 2000),
  
  -- Timestamps and versioning
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  
  constraint boutique_verification_submissions_legal_name_length check (length(legal_business_name) between 1 and 200),
  constraint boutique_verification_submissions_pan_format check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  constraint boutique_verification_submissions_gstin_format check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  constraint boutique_verification_submissions_postal_code_format check (postal_code ~ '^[0-9]{6}$'),
  constraint boutique_verification_submissions_email_format check (contact_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  constraint boutique_verification_submissions_submitted_immutable check (
    (status = 'draft' and submitted_at is null) or
    (status != 'draft' and submitted_at is not null)
  ),
  constraint boutique_verification_submissions_review_state check (
    (status in ('draft','submitted') and reviewed_at is null and reviewing_admin_id is null) or
    (status in ('changes_requested','approved','rejected') and reviewed_at is not null and reviewing_admin_id is not null)
  )
);

create index idx_boutique_verification_submissions_boutique on public.boutique_verification_submissions(boutique_id);
create index idx_boutique_verification_submissions_owner on public.boutique_verification_submissions(submitting_owner_id);
create index idx_boutique_verification_submissions_status on public.boutique_verification_submissions(status);
create index idx_boutique_verification_submissions_submitted on public.boutique_verification_submissions(submitted_at) where submitted_at is not null;

alter table public.boutique_verification_submissions enable row level security;

comment on table public.boutique_verification_submissions is
'Stores boutique verification details submitted by owners and reviewed by AAL2 admins. Submitted snapshots are immutable.';

-- ============================================================================
-- TABLE: boutique_verification_documents
-- ============================================================================

create table if not exists public.boutique_verification_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.boutique_verification_submissions(id) on delete cascade,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  
  -- Document metadata
  category text not null check (category in (
    'business_registration',
    'gst_certificate',
    'pan_document',
    'address_proof',
    'authorized_representative_id',
    'other_supporting_document'
  )),
  storage_object_key text not null check (length(storage_object_key) <= 500),
  file_name text not null check (length(file_name) <= 255),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  
  -- Status
  status text not null default 'pending' check (status in ('pending','submitted','archived')),
  
  -- Timestamps
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_boutique_verification_documents_submission on public.boutique_verification_documents(submission_id);
create index idx_boutique_verification_documents_boutique on public.boutique_verification_documents(boutique_id);
create index idx_boutique_verification_documents_uploader on public.boutique_verification_documents(uploader_id);
create index idx_boutique_verification_documents_category on public.boutique_verification_documents(category);
create unique index idx_boutique_verification_documents_storage_key on public.boutique_verification_documents(storage_object_key);

alter table public.boutique_verification_documents enable row level security;

comment on table public.boutique_verification_documents is
'Records document metadata for boutique verification. Only object keys stored, never signed URLs. Submitted documents become immutable.';

-- ============================================================================
-- TABLE: boutique_verification_events
-- ============================================================================

create table if not exists public.boutique_verification_events (
  id bigint primary key generated always as identity,
  submission_id uuid not null references public.boutique_verification_submissions(id) on delete cascade,
  boutique_id uuid not null references public.boutiques(id) on delete cascade,
  
  -- Event details
  event_type text not null check (event_type in (
    'draft_created',
    'draft_updated',
    'document_attached',
    'document_removed',
    'submitted',
    'resubmitted',
    'approved',
    'changes_requested',
    'rejected'
  )),
  actor_id uuid not null references public.profiles(id),
  actor_role text not null,
  
  -- Event metadata
  metadata jsonb not null default '{}'::jsonb,
  reason text check (length(reason) <= 2000),
  
  -- Timestamp
  created_at timestamptz not null default now()
);

create index idx_boutique_verification_events_submission on public.boutique_verification_events(submission_id);
create index idx_boutique_verification_events_boutique on public.boutique_verification_events(boutique_id);
create index idx_boutique_verification_events_type on public.boutique_verification_events(event_type);
create index idx_boutique_verification_events_created on public.boutique_verification_events(created_at desc);

alter table public.boutique_verification_events enable row level security;

comment on table public.boutique_verification_events is
'Append-only timeline of all verification workflow actions by owners and admins.';

-- ============================================================================
-- RLS POLICIES: boutique_verification_submissions
-- ============================================================================

create policy boutique_verification_submissions_owner_read on public.boutique_verification_submissions
for select to authenticated
using (
  submitting_owner_id = auth.uid()
  and exists (
    select 1 from public.boutiques b
    where b.id = boutique_id and b.owner_id = auth.uid()
  )
);

create policy boutique_verification_submissions_admin_read on public.boutique_verification_submissions
for select to authenticated
using (
  public.is_admin_aal2()
);

-- No direct insert/update/delete - use RPCs only

-- ============================================================================
-- RLS POLICIES: boutique_verification_documents
-- ============================================================================

create policy boutique_verification_documents_owner_read on public.boutique_verification_documents
for select to authenticated
using (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.boutiques b
    where b.id = boutique_id and b.owner_id = auth.uid()
  )
);

create policy boutique_verification_documents_admin_read on public.boutique_verification_documents
for select to authenticated
using (
  public.is_admin_aal2()
);

-- No direct insert/update/delete - use RPCs only

-- ============================================================================
-- RLS POLICIES: boutique_verification_events
-- ============================================================================

create policy boutique_verification_events_owner_read on public.boutique_verification_events
for select to authenticated
using (
  exists (
    select 1 from public.boutique_verification_submissions s
    where s.id = submission_id
      and s.submitting_owner_id = auth.uid()
      and exists (
        select 1 from public.boutiques b
        where b.id = s.boutique_id and b.owner_id = auth.uid()
      )
  )
);

create policy boutique_verification_events_admin_read on public.boutique_verification_events
for select to authenticated
using (
  public.is_admin_aal2()
);

-- No direct insert/update/delete - use RPCs only

-- ============================================================================
-- RPC: owner_create_verification_draft
-- ============================================================================

create or replace function public.owner_create_verification_draft(
  p_boutique_id uuid,
  p_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boutique record;
  v_submission_id uuid;
  v_event_id bigint;
begin
  -- Authorization: require authenticated boutique owner
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Lock boutique and verify ownership
  select id, owner_id, status
  into v_boutique
  from public.boutiques
  where id = p_boutique_id
  for update;

  if not found then
    raise exception 'Boutique not found';
  end if;

  if v_boutique.owner_id != auth.uid() then
    raise exception 'Only the boutique owner can create verification drafts';
  end if;

  if v_boutique.status not in ('draft', 'rejected') then
    raise exception 'Verification draft can only be created for draft or rejected boutiques';
  end if;

  -- Check for existing draft
  if exists (
    select 1 from public.boutique_verification_submissions
    where boutique_id = p_boutique_id
      and status = 'draft'
  ) then
    raise exception 'A draft verification already exists for this boutique';
  end if;

  -- Validate required fields
  if not (
    p_details ? 'legal_business_name' and
    p_details ? 'business_type' and
    p_details ? 'registration_number' and
    p_details ? 'pan' and
    p_details ? 'registered_address_line1' and
    p_details ? 'city' and
    p_details ? 'state' and
    p_details ? 'postal_code' and
    p_details ? 'authorized_rep_name' and
    p_details ? 'authorized_rep_role' and
    p_details ? 'contact_email' and
    p_details ? 'contact_phone'
  ) then
    raise exception 'Missing required verification fields';
  end if;

  -- Create draft submission
  insert into public.boutique_verification_submissions (
    boutique_id,
    submitting_owner_id,
    legal_business_name,
    public_trading_name,
    business_type,
    registration_number,
    gstin,
    pan,
    registered_address_line1,
    registered_address_line2,
    city,
    state,
    postal_code,
    authorized_rep_name,
    authorized_rep_role,
    contact_email,
    contact_phone,
    status
  ) values (
    p_boutique_id,
    auth.uid(),
    p_details->>'legal_business_name',
    p_details->>'public_trading_name',
    p_details->>'business_type',
    p_details->>'registration_number',
    p_details->>'gstin',
    p_details->>'pan',
    p_details->>'registered_address_line1',
    p_details->>'registered_address_line2',
    p_details->>'city',
    p_details->>'state',
    p_details->>'postal_code',
    p_details->>'authorized_rep_name',
    p_details->>'authorized_rep_role',
    p_details->>'contact_email',
    p_details->>'contact_phone',
    'draft'
  )
  returning id into v_submission_id;

  -- Record event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  ) values (
    v_submission_id,
    p_boutique_id,
    'draft_created',
    auth.uid(),
    'boutique_owner',
    jsonb_build_object('submission_id', v_submission_id)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'event_id', v_event_id
  );
end;
$$;

comment on function public.owner_create_verification_draft is
'Creates a new draft verification submission for the boutique owner. Only one draft allowed per boutique.';

-- ============================================================================
-- RPC: owner_update_verification_draft
-- ============================================================================

create or replace function public.owner_update_verification_draft(
  p_submission_id uuid,
  p_details jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_event_id bigint;
begin
  -- Authorization
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Lock and verify
  select s.id, s.boutique_id, s.submitting_owner_id, s.status, s.version, b.owner_id, b.status as boutique_status
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.submitting_owner_id != auth.uid() or v_submission.owner_id != auth.uid() then
    raise exception 'Only the boutique owner can update this verification draft';
  end if;

  if v_submission.status not in ('draft', 'changes_requested') then
    raise exception 'Only draft or changes-requested submissions can be updated';
  end if;

  if v_submission.version != p_expected_version then
    raise exception 'Optimistic concurrency conflict: submission was modified';
  end if;

  -- Validate required fields
  if not (
    p_details ? 'legal_business_name' and
    p_details ? 'business_type' and
    p_details ? 'registration_number' and
    p_details ? 'pan' and
    p_details ? 'registered_address_line1' and
    p_details ? 'city' and
    p_details ? 'state' and
    p_details ? 'postal_code' and
    p_details ? 'authorized_rep_name' and
    p_details ? 'authorized_rep_role' and
    p_details ? 'contact_email' and
    p_details ? 'contact_phone'
  ) then
    raise exception 'Missing required verification fields';
  end if;

  -- Update submission
  update public.boutique_verification_submissions
  set
    legal_business_name = p_details->>'legal_business_name',
    public_trading_name = p_details->>'public_trading_name',
    business_type = p_details->>'business_type',
    registration_number = p_details->>'registration_number',
    gstin = p_details->>'gstin',
    pan = p_details->>'pan',
    registered_address_line1 = p_details->>'registered_address_line1',
    registered_address_line2 = p_details->>'registered_address_line2',
    city = p_details->>'city',
    state = p_details->>'state',
    postal_code = p_details->>'postal_code',
    authorized_rep_name = p_details->>'authorized_rep_name',
    authorized_rep_role = p_details->>'authorized_rep_role',
    contact_email = p_details->>'contact_email',
    contact_phone = p_details->>'contact_phone',
    updated_at = now(),
    version = version + 1
  where id = p_submission_id;

  -- Record event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    'draft_updated',
    auth.uid(),
    'boutique_owner',
    jsonb_build_object('version', p_expected_version + 1)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'version', p_expected_version + 1,
    'event_id', v_event_id
  );
end;
$$;

comment on function public.owner_update_verification_draft is
'Updates a draft or changes-requested verification submission with optimistic concurrency control.';

-- ============================================================================
-- RPC: owner_attach_verification_document
-- ============================================================================

create or replace function public.owner_attach_verification_document(
  p_submission_id uuid,
  p_category text,
  p_storage_object_key text,
  p_file_name text,
  p_file_size_bytes integer,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_document_id uuid;
  v_event_id bigint;
begin
  -- Authorization
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Validate document category
  if p_category not in (
    'business_registration',
    'gst_certificate',
    'pan_document',
    'address_proof',
    'authorized_representative_id',
    'other_supporting_document'
  ) then
    raise exception 'Invalid document category';
  end if;

  -- Lock and verify submission
  select s.id, s.boutique_id, s.submitting_owner_id, s.status, b.owner_id
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.submitting_owner_id != auth.uid() or v_submission.owner_id != auth.uid() then
    raise exception 'Only the boutique owner can attach documents';
  end if;

  if v_submission.status not in ('draft', 'changes_requested') then
    raise exception 'Documents can only be attached to draft or changes-requested submissions';
  end if;

  -- Validate storage object key belongs to correct boutique and user
  if not public.can_write_verification_document(p_storage_object_key) then
    raise exception 'Invalid storage object key: must belong to your boutique';
  end if;

  -- Validate file size and mime type
  if p_file_size_bytes <= 0 or p_file_size_bytes > 15728640 then
    raise exception 'File size must be between 1 byte and 15 MB';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'Invalid file type: only JPEG, PNG, WebP, and PDF allowed';
  end if;

  -- Check for duplicate storage key
  if exists (
    select 1 from public.boutique_verification_documents
    where storage_object_key = p_storage_object_key
  ) then
    raise exception 'This document has already been attached';
  end if;

  -- Create document record
  insert into public.boutique_verification_documents (
    submission_id,
    boutique_id,
    uploader_id,
    category,
    storage_object_key,
    file_name,
    file_size_bytes,
    mime_type,
    status
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    auth.uid(),
    p_category,
    p_storage_object_key,
    p_file_name,
    p_file_size_bytes,
    p_mime_type,
    'pending'
  )
  returning id into v_document_id;

  -- Record event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    'document_attached',
    auth.uid(),
    'boutique_owner',
    jsonb_build_object(
      'document_id', v_document_id,
      'category', p_category,
      'file_name', p_file_name
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'success', true,
    'document_id', v_document_id,
    'event_id', v_event_id
  );
end;
$$;

comment on function public.owner_attach_verification_document is
'Attaches a verification document to a draft or changes-requested submission. Validates storage key ownership.';

-- ============================================================================
-- RPC: owner_remove_verification_document
-- ============================================================================

create or replace function public.owner_remove_verification_document(
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document record;
  v_event_id bigint;
begin
  -- Authorization
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Lock and verify document
  select d.id, d.submission_id, d.boutique_id, d.uploader_id, d.status, d.category, d.file_name,
         s.submitting_owner_id, s.status as submission_status,
         b.owner_id
  into v_document
  from public.boutique_verification_documents d
  join public.boutique_verification_submissions s on s.id = d.submission_id
  join public.boutiques b on b.id = d.boutique_id
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  if v_document.uploader_id != auth.uid() or v_document.owner_id != auth.uid() then
    raise exception 'Only the document uploader can remove it';
  end if;

  if v_document.submission_status not in ('draft', 'changes_requested') then
    raise exception 'Documents can only be removed from draft or changes-requested submissions';
  end if;

  if v_document.status = 'submitted' then
    raise exception 'Submitted documents cannot be removed';
  end if;

  -- Delete document record
  delete from public.boutique_verification_documents
  where id = p_document_id;

  -- Record event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  ) values (
    v_document.submission_id,
    v_document.boutique_id,
    'document_removed',
    auth.uid(),
    'boutique_owner',
    jsonb_build_object(
      'document_id', p_document_id,
      'category', v_document.category,
      'file_name', v_document.file_name
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'success', true,
    'event_id', v_event_id
  );
end;
$$;

comment on function public.owner_remove_verification_document is
'Removes an unsubmitted verification document from a draft or changes-requested submission.';

-- ============================================================================
-- RPC: owner_submit_verification
-- ============================================================================

create or replace function public.owner_submit_verification(
  p_submission_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_required_docs text[];
  v_missing_docs text[];
  v_event_id bigint;
  v_audit_id bigint;
  v_outbox_id bigint;
  v_is_resubmission boolean;
begin
  -- Authorization
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Lock and verify
  select s.id, s.boutique_id, s.submitting_owner_id, s.status, s.version,
         s.legal_business_name, s.registration_number, s.pan, s.gstin,
         s.registered_address_line1, s.city, s.state, s.postal_code,
         s.authorized_rep_name, s.contact_email,
         b.owner_id, b.status as boutique_status, b.name as boutique_name
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.submitting_owner_id != auth.uid() or v_submission.owner_id != auth.uid() then
    raise exception 'Only the boutique owner can submit verification';
  end if;

  if v_submission.status not in ('draft', 'changes_requested') then
    raise exception 'Only draft or changes-requested submissions can be submitted';
  end if;

  if v_submission.version != p_expected_version then
    raise exception 'Optimistic concurrency conflict: submission was modified';
  end if;

  if v_submission.boutique_status = 'suspended' then
    raise exception 'Cannot submit verification for suspended boutique';
  end if;

  -- Validate all required fields are present and non-empty
  if v_submission.legal_business_name is null or trim(v_submission.legal_business_name) = '' then
    raise exception 'Legal business name is required';
  end if;
  if v_submission.registration_number is null or trim(v_submission.registration_number) = '' then
    raise exception 'Business registration number is required';
  end if;
  if v_submission.pan is null or trim(v_submission.pan) = '' then
    raise exception 'PAN is required';
  end if;

  -- Check required documents are attached
  v_required_docs := array['business_registration', 'pan_document', 'address_proof'];
  
  select array_agg(required_cat)
  into v_missing_docs
  from unnest(v_required_docs) as required_cat
  where not exists (
    select 1 from public.boutique_verification_documents d
    where d.submission_id = p_submission_id
      and d.category = required_cat
      and d.status in ('pending', 'submitted')
  );

  if v_missing_docs is not null and array_length(v_missing_docs, 1) > 0 then
    raise exception 'Missing required documents: %', array_to_string(v_missing_docs, ', ');
  end if;

  -- Determine if resubmission
  v_is_resubmission := (v_submission.status = 'changes_requested');

  -- Lock boutique and update status
  update public.boutiques
  set
    status = 'pending_verification',
    updated_at = now()
  where id = v_submission.boutique_id;

  -- Update submission status
  update public.boutique_verification_submissions
  set
    status = 'submitted',
    submitted_at = now(),
    reviewed_at = null,
    reviewing_admin_id = null,
    admin_decision_reason = null,
    updated_at = now(),
    version = version + 1
  where id = p_submission_id;

  -- Mark all documents as submitted
  update public.boutique_verification_documents
  set status = 'submitted'
  where submission_id = p_submission_id and status = 'pending';

  -- Record verification event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    case when v_is_resubmission then 'resubmitted' else 'submitted' end,
    auth.uid(),
    'boutique_owner',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'version', p_expected_version + 1,
      'is_resubmission', v_is_resubmission
    )
  )
  returning id into v_event_id;

  -- Record audit event (with masked identifiers)
  v_audit_id := public.append_audit_event(
    p_action := 'boutique_verification.submitted',
    p_entity_type := 'boutique_verification_submission',
    p_entity_id := p_submission_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'boutique_owner',
    p_after_json := jsonb_build_object(
      'status', 'submitted',
      'boutique_id', v_submission.boutique_id,
      'legal_business_name', v_submission.legal_business_name,
      'pan_masked', 'XXX' || right(v_submission.pan, 4)
    ),
    p_metadata := jsonb_build_object(
      'boutique_name', v_submission.boutique_name,
      'is_resubmission', v_is_resubmission
    )
  );

  -- Enqueue outbox event for notification
  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'boutique_verification_submission',
    p_submission_id::text,
    'verification_submitted',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name,
      'submitter_id', auth.uid(),
      'is_resubmission', v_is_resubmission
    )
  )
  returning id into v_outbox_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'version', p_expected_version + 1,
    'event_id', v_event_id,
    'audit_id', v_audit_id,
    'outbox_id', v_outbox_id
  );
end;
$$;

comment on function public.owner_submit_verification is
'Submits a verification for admin review. Validates required fields and documents. Updates boutique status atomically.';

-- ============================================================================
-- RPC: admin_read_verification_submission
-- ============================================================================

create or replace function public.admin_read_verification_submission(
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_documents jsonb;
  v_events jsonb;
begin
  -- Authorization: require AAL2 admin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Fetch submission
  select
    s.id,
    s.boutique_id,
    s.submitting_owner_id,
    s.legal_business_name,
    s.public_trading_name,
    s.business_type,
    s.registration_number,
    s.gstin,
    s.pan,
    s.registered_address_line1,
    s.registered_address_line2,
    s.city,
    s.state,
    s.postal_code,
    s.country,
    s.authorized_rep_name,
    s.authorized_rep_role,
    s.contact_email,
    s.contact_phone,
    s.status,
    s.declaration_version,
    s.submitted_at,
    s.reviewed_at,
    s.reviewing_admin_id,
    s.admin_decision_reason,
    s.created_at,
    s.updated_at,
    s.version,
    b.name as boutique_name,
    b.slug as boutique_slug,
    b.status as boutique_status,
    p.display_name as owner_display_name,
    au.email as owner_email
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  join public.profiles p on p.id = s.submitting_owner_id
  join auth.users au on au.id = s.submitting_owner_id
  where s.id = p_submission_id;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  -- Fetch documents
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'category', d.category,
        'file_name', d.file_name,
        'file_size_bytes', d.file_size_bytes,
        'mime_type', d.mime_type,
        'status', d.status,
        'uploaded_at', d.uploaded_at,
        'storage_object_key', d.storage_object_key
      )
      order by d.uploaded_at asc
    ),
    '[]'::jsonb
  )
  into v_documents
  from public.boutique_verification_documents d
  where d.submission_id = p_submission_id;

  -- Fetch events
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'actor_id', e.actor_id,
        'actor_role', e.actor_role,
        'metadata', e.metadata,
        'reason', e.reason,
        'created_at', e.created_at
      )
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.boutique_verification_events e
  where e.submission_id = p_submission_id;

  -- Return complete submission with documents and events
  return jsonb_build_object(
    'id', v_submission.id,
    'boutique_id', v_submission.boutique_id,
    'boutique_name', v_submission.boutique_name,
    'boutique_slug', v_submission.boutique_slug,
    'boutique_status', v_submission.boutique_status,
    'submitting_owner_id', v_submission.submitting_owner_id,
    'owner_display_name', v_submission.owner_display_name,
    'owner_email', v_submission.owner_email,
    'legal_business_name', v_submission.legal_business_name,
    'public_trading_name', v_submission.public_trading_name,
    'business_type', v_submission.business_type,
    'registration_number', v_submission.registration_number,
    'gstin', v_submission.gstin,
    'pan', v_submission.pan,
    'registered_address_line1', v_submission.registered_address_line1,
    'registered_address_line2', v_submission.registered_address_line2,
    'city', v_submission.city,
    'state', v_submission.state,
    'postal_code', v_submission.postal_code,
    'country', v_submission.country,
    'authorized_rep_name', v_submission.authorized_rep_name,
    'authorized_rep_role', v_submission.authorized_rep_role,
    'contact_email', v_submission.contact_email,
    'contact_phone', v_submission.contact_phone,
    'status', v_submission.status,
    'declaration_version', v_submission.declaration_version,
    'submitted_at', v_submission.submitted_at,
    'reviewed_at', v_submission.reviewed_at,
    'reviewing_admin_id', v_submission.reviewing_admin_id,
    'admin_decision_reason', v_submission.admin_decision_reason,
    'created_at', v_submission.created_at,
    'updated_at', v_submission.updated_at,
    'version', v_submission.version,
    'documents', v_documents,
    'events', v_events
  );
end;
$$;

comment on function public.admin_read_verification_submission is
'Returns complete verification submission with documents and events for AAL2 admin review.';

-- ============================================================================
-- RPC: admin_approve_verification
-- ============================================================================

create or replace function public.admin_approve_verification(
  p_submission_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_required_docs text[];
  v_missing_docs text[];
  v_event_id bigint;
  v_audit_id bigint;
  v_outbox_id bigint;
begin
  -- Authorization: require AAL2 admin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Validate reason
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Approval reason is required';
  end if;
  if length(trim(p_reason)) > 2000 then
    raise exception 'Approval reason is too long';
  end if;

  -- Lock and verify submission
  select
    s.id, s.boutique_id, s.submitting_owner_id, s.status,
    s.legal_business_name, s.registration_number, s.pan,
    b.status as boutique_status, b.name as boutique_name
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.status != 'submitted' then
    raise exception 'Only submitted verifications can be approved';
  end if;

  if v_submission.boutique_status = 'suspended' then
    raise exception 'Cannot approve verification for suspended boutique';
  end if;

  -- Re-validate required fields
  if v_submission.legal_business_name is null or trim(v_submission.legal_business_name) = '' then
    raise exception 'Legal business name is missing';
  end if;
  if v_submission.registration_number is null or trim(v_submission.registration_number) = '' then
    raise exception 'Business registration number is missing';
  end if;
  if v_submission.pan is null or trim(v_submission.pan) = '' then
    raise exception 'PAN is missing';
  end if;

  -- Re-validate required documents
  v_required_docs := array['business_registration', 'pan_document', 'address_proof'];
  
  select array_agg(required_cat)
  into v_missing_docs
  from unnest(v_required_docs) as required_cat
  where not exists (
    select 1 from public.boutique_verification_documents d
    where d.submission_id = p_submission_id
      and d.category = required_cat
      and d.status = 'submitted'
  );

  if v_missing_docs is not null and array_length(v_missing_docs, 1) > 0 then
    raise exception 'Missing required documents: %', array_to_string(v_missing_docs, ', ');
  end if;

  -- Update boutique status to verified
  update public.boutiques
  set
    status = 'verified',
    updated_at = now()
  where id = v_submission.boutique_id;

  -- Update submission status
  update public.boutique_verification_submissions
  set
    status = 'approved',
    reviewed_at = now(),
    reviewing_admin_id = auth.uid(),
    admin_decision_reason = p_reason,
    updated_at = now()
  where id = p_submission_id;

  -- Record verification event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    reason,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    'approved',
    auth.uid(),
    'admin',
    p_reason,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'reviewing_admin_id', auth.uid()
    )
  )
  returning id into v_event_id;

  -- Record audit event
  v_audit_id := public.append_audit_event(
    p_action := 'boutique_verification.approved',
    p_entity_type := 'boutique_verification_submission',
    p_entity_id := p_submission_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'admin',
    p_before_json := jsonb_build_object(
      'status', 'submitted',
      'boutique_status', v_submission.boutique_status
    ),
    p_after_json := jsonb_build_object(
      'status', 'approved',
      'boutique_status', 'verified'
    ),
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name
    )
  );

  -- Enqueue outbox event for notification
  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'boutique_verification_submission',
    p_submission_id::text,
    'verification_approved',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name,
      'owner_id', v_submission.submitting_owner_id,
      'admin_id', auth.uid()
    )
  )
  returning id into v_outbox_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'boutique_id', v_submission.boutique_id,
    'event_id', v_event_id,
    'audit_id', v_audit_id,
    'outbox_id', v_outbox_id
  );
end;
$$;

comment on function public.admin_approve_verification is
'Approves a submitted verification. Sets boutique to verified status. Records audit and outbox events. Requires AAL2 admin.';

-- ============================================================================
-- RPC: admin_request_verification_changes
-- ============================================================================

create or replace function public.admin_request_verification_changes(
  p_submission_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_event_id bigint;
  v_audit_id bigint;
  v_outbox_id bigint;
begin
  -- Authorization: require AAL2 admin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Validate reason
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Change request reason is required';
  end if;
  if length(trim(p_reason)) > 2000 then
    raise exception 'Change request reason is too long';
  end if;

  -- Lock and verify submission
  select
    s.id, s.boutique_id, s.submitting_owner_id, s.status,
    s.legal_business_name, s.pan,
    b.status as boutique_status, b.name as boutique_name
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.status != 'submitted' then
    raise exception 'Only submitted verifications can have changes requested';
  end if;

  -- Update boutique status back to draft
  update public.boutiques
  set
    status = 'draft',
    updated_at = now()
  where id = v_submission.boutique_id;

  -- Update submission status
  update public.boutique_verification_submissions
  set
    status = 'changes_requested',
    reviewed_at = now(),
    reviewing_admin_id = auth.uid(),
    admin_decision_reason = p_reason,
    updated_at = now()
  where id = p_submission_id;

  -- Record verification event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    reason,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    'changes_requested',
    auth.uid(),
    'admin',
    p_reason,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'reviewing_admin_id', auth.uid()
    )
  )
  returning id into v_event_id;

  -- Record audit event
  v_audit_id := public.append_audit_event(
    p_action := 'boutique_verification.changes_requested',
    p_entity_type := 'boutique_verification_submission',
    p_entity_id := p_submission_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'admin',
    p_before_json := jsonb_build_object(
      'status', 'submitted',
      'boutique_status', v_submission.boutique_status
    ),
    p_after_json := jsonb_build_object(
      'status', 'changes_requested',
      'boutique_status', 'draft'
    ),
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name
    )
  );

  -- Enqueue outbox event for notification
  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'boutique_verification_submission',
    p_submission_id::text,
    'verification_changes_requested',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name,
      'owner_id', v_submission.submitting_owner_id,
      'admin_id', auth.uid(),
      'reason', p_reason
    )
  )
  returning id into v_outbox_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'boutique_id', v_submission.boutique_id,
    'event_id', v_event_id,
    'audit_id', v_audit_id,
    'outbox_id', v_outbox_id
  );
end;
$$;

comment on function public.admin_request_verification_changes is
'Requests changes to a submitted verification. Moves boutique to draft and submission to changes_requested. Requires AAL2 admin.';

-- ============================================================================
-- RPC: admin_reject_verification
-- ============================================================================

create or replace function public.admin_reject_verification(
  p_submission_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission record;
  v_event_id bigint;
  v_audit_id bigint;
  v_outbox_id bigint;
begin
  -- Authorization: require AAL2 admin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin_aal2() then
    raise exception 'Administrator AAL2 authentication required';
  end if;

  -- Validate reason
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Rejection reason is required';
  end if;
  if length(trim(p_reason)) > 2000 then
    raise exception 'Rejection reason is too long';
  end if;

  -- Lock and verify submission
  select
    s.id, s.boutique_id, s.submitting_owner_id, s.status,
    s.legal_business_name, s.pan,
    b.status as boutique_status, b.name as boutique_name
  into v_submission
  from public.boutique_verification_submissions s
  join public.boutiques b on b.id = s.boutique_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Verification submission not found';
  end if;

  if v_submission.status != 'submitted' then
    raise exception 'Only submitted verifications can be rejected';
  end if;

  -- Update boutique status to rejected
  update public.boutiques
  set
    status = 'rejected',
    is_published = false,
    updated_at = now()
  where id = v_submission.boutique_id;

  -- Update submission status
  update public.boutique_verification_submissions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewing_admin_id = auth.uid(),
    admin_decision_reason = p_reason,
    updated_at = now()
  where id = p_submission_id;

  -- Record verification event
  insert into public.boutique_verification_events (
    submission_id,
    boutique_id,
    event_type,
    actor_id,
    actor_role,
    reason,
    metadata
  ) values (
    p_submission_id,
    v_submission.boutique_id,
    'rejected',
    auth.uid(),
    'admin',
    p_reason,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'reviewing_admin_id', auth.uid()
    )
  )
  returning id into v_event_id;

  -- Record audit event
  v_audit_id := public.append_audit_event(
    p_action := 'boutique_verification.rejected',
    p_entity_type := 'boutique_verification_submission',
    p_entity_id := p_submission_id::text,
    p_actor_id := auth.uid(),
    p_actor_role := 'admin',
    p_before_json := jsonb_build_object(
      'status', 'submitted',
      'boutique_status', v_submission.boutique_status
    ),
    p_after_json := jsonb_build_object(
      'status', 'rejected',
      'boutique_status', 'rejected'
    ),
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name
    )
  );

  -- Enqueue outbox event for notification
  insert into public.outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) values (
    'boutique_verification_submission',
    p_submission_id::text,
    'verification_rejected',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'boutique_id', v_submission.boutique_id,
      'boutique_name', v_submission.boutique_name,
      'owner_id', v_submission.submitting_owner_id,
      'admin_id', auth.uid(),
      'reason', p_reason
    )
  )
  returning id into v_outbox_id;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'boutique_id', v_submission.boutique_id,
    'event_id', v_event_id,
    'audit_id', v_audit_id,
    'outbox_id', v_outbox_id
  );
end;
$$;

comment on function public.admin_reject_verification is
'Rejects a submitted verification. Sets boutique to rejected status and unpublishes. Records audit and outbox events. Requires AAL2 admin.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Revoke all permissions from public, anonymous, and authenticated roles
revoke all on table public.boutique_verification_submissions from public, anon, authenticated;
revoke all on table public.boutique_verification_documents from public, anon, authenticated;
revoke all on table public.boutique_verification_events from public, anon, authenticated;

-- Grant select only to authenticated (RLS will enforce further restrictions)
grant select on table public.boutique_verification_submissions to authenticated;
grant select on table public.boutique_verification_documents to authenticated;
grant select on table public.boutique_verification_events to authenticated;

-- Revoke all function permissions
revoke all on function public.owner_create_verification_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.owner_update_verification_draft(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.owner_attach_verification_document(uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.owner_remove_verification_document(uuid) from public, anon, authenticated;
revoke all on function public.owner_submit_verification(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_read_verification_submission(uuid) from public, anon, authenticated;
revoke all on function public.admin_approve_verification(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_request_verification_changes(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_reject_verification(uuid, text) from public, anon, authenticated;

-- Grant execute to authenticated (RPCs will enforce role/AAL internally)
grant execute on function public.owner_create_verification_draft(uuid, jsonb) to authenticated;
grant execute on function public.owner_update_verification_draft(uuid, jsonb, integer) to authenticated;
grant execute on function public.owner_attach_verification_document(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.owner_remove_verification_document(uuid) to authenticated;
grant execute on function public.owner_submit_verification(uuid, integer) to authenticated;
grant execute on function public.admin_read_verification_submission(uuid) to authenticated;
grant execute on function public.admin_approve_verification(uuid, text) to authenticated;
grant execute on function public.admin_request_verification_changes(uuid, text) to authenticated;
grant execute on function public.admin_reject_verification(uuid, text) to authenticated;

notify pgrst, 'reload schema';
