# FADEN Remaining Build Plan — Cursor Execution Specification

This document is the source of truth for completing FADEN. It is deliberately written as small, sequential tickets that a small coding model can execute without making product or architecture decisions.

## 1. Product and repository context

FADEN is an India-first custom luxury-fashion marketplace with three Next.js applications and one Supabase backend:

| Application     | Workspace          | Local URL               | Purpose                                                                 |
| --------------- | ------------------ | ----------------------- | ----------------------------------------------------------------------- |
| Marketplace     | `apps/marketplace` | `http://localhost:3000` | Customer discovery, requests, offers, orders and aftercare              |
| Boutique Studio | `apps/studio`      | `http://localhost:3001` | Boutique requests, offers, production, appointments and fulfilment      |
| Platform Admin  | `apps/admin`       | `http://localhost:3002` | FADEN operations, verification, disputes, settlements and configuration |

Shared code belongs in `packages/*`. Database changes belong in append-only Supabase migrations. The current migration sequence ends at `supabase/migrations/202609010021_storage_foundation.sql`.

The Stitch source-of-truth inventory is `design-reference/stitch/manifest.json`. Screenshots are under `design-reference/stitch/screenshots/` and exported HTML is under `design-reference/stitch/html/`. Reproduce the visual system, but do not copy unsafe client-side data handling from generated HTML.

## 2. Instructions for Cursor

### 2.1 Execute one ticket at a time

For every ticket below:

1. Read the ticket and every existing file it names.
2. Read the matching Stitch screenshot and HTML before changing UI.
3. Inspect existing types, components, SQL functions and RLS policies before creating new ones.
4. Implement only that ticket. Do not start the next ticket.
5. Add or update tests specified by the ticket.
6. Run the ticket validation commands.
7. Run the global completion gate in section 2.4.
8. Update the ticket checkbox from `[ ]` to `[x]` only after all acceptance criteria pass.
9. Commit with the ticket ID, for example `git commit -m "A01 Add admin application shell"`.
10. Push the branch and wait for GitHub Actions and Vercel preview checks.

If a ticket requires a secret or external account, implement and test a disabled/readiness state. Never invent credentials and never commit a secret.

### 2.2 Non-negotiable architecture rules

- Use the existing Next.js App Router structure.
- Use Supabase as the only application database.
- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SECRET_KEY`, Razorpay, Daily, SMTP and Shiprocket secrets are server-only.
- Never import a server-only module into a client component.
- Use the authenticated Supabase server client for user-scoped reads and mutations.
- Use a service-role client only in verified webhooks or narrowly scoped admin server operations.
- Every new table must have RLS enabled, explicit grants and policy tests.
- Prefer a security-definer RPC for a multi-table or state-transition mutation.
- Validate authorization again inside the RPC. UI hiding is not authorization.
- Require same-origin requests for cookie-authenticated mutation routes.
- Validate request size and shape. Do not pass arbitrary JSON directly to SQL.
- Use idempotency keys for payments, shipments, emails and state-transition commands.
- Store money as integer paise, never floating-point rupees.
- Store timestamps as `timestamptz`; display in `Asia/Kolkata` where appropriate.
- Do not weaken existing RLS policies to make a UI work.
- Do not edit an old migration already used by CI or hosted Supabase. Add the next numbered migration.
- Public preview routes must use fictional data and must never query private customer records.
- Keep phone OTP disabled until a later explicit decision.
- Keep Daily recording disabled.
- Keep live Razorpay and Shiprocket actions disabled until their activation tickets.

### 2.3 UI implementation rules

- Reuse existing FADEN tokens and shared components before creating new CSS.
- Match the corresponding Stitch screen at desktop and mobile widths.
- Every page must include loading, empty, error and success states.
- All controls must be keyboard accessible and have visible focus states.
- Form errors must be associated with their fields.
- Images require meaningful alt text or empty alt text when decorative.
- Tables must become cards or allow safe horizontal scrolling on small screens.
- Do not place important actions behind hover-only interactions.
- Destructive actions require a confirmation step and a server-side authorization check.

### 2.4 Global completion gate

Run after every ticket:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

When a ticket adds SQL, also run:

```bash
npx supabase db reset
npm run supabase:test
npm run supabase:types
git diff --exit-code packages/database/src/database.types.ts
```

When a ticket changes a complete user journey, add a focused script in `scripts/` and include it in the root `test` command or the applicable workspace test command.

### 2.5 Definition of done

A ticket is done only when:

- Its acceptance criteria are demonstrably satisfied.
- Unauthorized users cannot read or change the new data.
- The page works with real local Supabase data, not hard-coded production data.
- Empty, failure and loading states are present.
- Desktop and mobile layouts were checked.
- Tests cover the happy path and at least one authorization/failure path.
- All global checks pass.
- GitHub Actions passes and the relevant Vercel preview is usable.
- Documentation and environment examples are updated when applicable.

## 3. Current implementation inventory

Do not rebuild these features from scratch. Extend them:

- Supabase email authentication, Google OAuth hooks, role-based profiles and admin TOTP MFA.
- Catalog discovery, boutique pages, design pages, saved boutiques and saved designs.
- Customer outfit request wizard, measurement profile, boutique sharing and offer comparison.
- Test-only order checkout and payment-attempt foundation.
- Design review, production rehearsal, appointments, delivery rehearsal, aftercare and messaging.
- Boutique overview, requests, offers, orders, production, appointments and portfolio management.
- Daily private-room/token integration foundation, currently disabled until configured.
- Shiprocket integration/readiness foundation, currently disabled until configured.
- GitHub Actions, Docker builds and GitHub-to-Vercel preview deployment.

Known incomplete areas:

- Admin is only an authenticated/MFA-protected foundation page.
- Several Studio and Marketplace mutations are intentionally blocked when `NEXT_PUBLIC_APP_ENV=production`.
- Live payments and refunds are not active.
- Live courier booking is not active.
- Daily credentials and live-room flags are not active.
- Storage-backed image/document uploads are incomplete.
- Automated transactional email orchestration is incomplete.
- Production monitoring, complete E2E coverage and legal pages are incomplete.

## 4. Delivery order

Execute phases in this order. Do not activate payments or shipping before the admin and boutique operational controls exist.

1. Phase F — shared production foundations
2. Phase A — complete Admin application
3. Phase B — complete Boutique Studio
4. Phase C — complete Marketplace/customer experience
5. Phase N — notifications and scheduled work
6. Phase I — external integrations and activation
7. Phase Q — security, quality and production launch

---

# Phase F — Shared production foundations

## [x] F01 Create feature-flag and integration-readiness package

**Goal:** Replace scattered environment checks with one typed server-side source of truth.

**Files:**

- Add `packages/integrations/src/readiness.mjs` and types if not already represented by the existing integration package.
- Update `packages/integrations/src/index.mjs` and `index.d.ts`.
- Add `docs/environment-variables.md`.
- Update all routes currently checking `NEXT_PUBLIC_APP_ENV === "production"` directly.

**Required behavior:**

- Expose typed readiness functions for payments, shipping, Daily, maps and email.
- Each returns `{ configured, enabled, live, missing }` without returning secret values.
- A live action requires credentials, an explicit server-only enable flag and production-safe configuration.
- Public variables may control display only; they must never authorize a live server action.
- Replace production blanket blocks with explicit server-only flags such as `FADEN_ENABLE_LIVE_WORKFLOWS`.
- Default every live integration flag to false.

**Acceptance:**

- No API route uses a `NEXT_PUBLIC_*` variable as its only security control.
- Readiness responses never reveal credentials.
- Unit tests cover missing, partially configured and enabled states.

## [x] F02 Add consistent API request guards

**Goal:** Standardize same-origin, authentication, body-size and error handling.

**Files:**

- Add `packages/server/src/request-guards.ts` or the closest existing server package.
- Refactor mutation routes in all three apps.

**Required helpers:**

- `requireSameOrigin(request)`
- `requireUser(supabase)`
- `readJsonBody(request, maxBytes)`
- `jsonError(message, status, code?)`
- `requireAdminAal2(supabase)`

**Acceptance:**

- Every cookie-authenticated POST/PATCH/DELETE route uses same-origin validation.
- Errors have a stable `{ error, code? }` structure.
- Guard tests cover missing session, invalid origin, oversized body and invalid JSON.

## [x] F03 Add Supabase Storage foundations

**Goal:** Provide safe private and public uploads.

**Migration:** `202609010021_storage_foundation.sql`.

**Buckets:**

- `portfolio-images`: public read, authorized boutique-member write.
- `request-inspirations`: private, request owner read/write; explicitly shared boutiques receive read-only access only after consent.
- `order-files`: private, order customer and original boutique owner read/write according to file purpose.
- `verification-documents`: private, submitting boutique owner and AAL2 admin only.

**Implementation:**

- Add server upload-signing routes; do not expose service role credentials.
- Restrict MIME types to approved images/PDF where applicable.
- Set size limits: images 10 MB, verification PDFs 15 MB.
- Generate collision-resistant object paths using authenticated user/boutique/order IDs.
- Strip EXIF metadata from customer inspiration images before public processing.

**Tests:**

- Owner upload/read.
- Unrelated-user denial.
- Shared-boutique request-image read.
- Suspended/revoked membership denial.
- Admin verification-document read at AAL2 only.

## [x] F04 Add image processing and reusable uploader

**Goal:** Replace URL-entry placeholders with reliable uploads.

**Files:**

- Add a reusable client uploader under `packages/ui/src/uploads/`.
- Add server validation in a shared server package.
- Integrate first with Studio portfolio and Marketplace request inspiration.

**Required behavior:**

- Drag/drop and file-picker support.
- Client preview, progress, cancel, retry and remove.
- Resize display images to sensible maximum dimensions while preserving originals only when required.
- Reject unsupported file types and oversized files before upload.
- Persist storage object keys, not expiring signed URLs.
- Render using transformed/signed URLs generated on demand.

**Acceptance:**

- Refreshing the page preserves successful uploads.
- Failed uploads do not create a database record.
- Removing an unreferenced upload removes its object safely.

## [x] F05 Add audit-event service

**Goal:** Make privileged and financially significant actions traceable.

**Migration:** `202609010022_audit_event_expansion.sql`.

**Required behavior:**

- Extend existing `audit_events`; do not create a duplicate audit table.
- Record actor ID, actor role, action, target type/ID, before/after safe JSON, request ID, IP hash, user-agent summary and timestamp.
- Never store passwords, tokens, full payment data or measurement details in audit JSON.
- Audit admin decisions, boutique status changes, refunds, disputes, configuration changes, payout changes and role changes.
- Audit entries are append-only for API roles.

**Acceptance:**

- A normal user cannot read audit events.
- An AAL2 admin can read but cannot update/delete them.
- SQL tests prove append-only behavior.

---

# Phase A — Complete Platform Admin

Use these Stitch references: `Platform Overview — FADEN Admin`, `Platform Overview (Mobile Admin)`, `Boutiques — FADEN Admin`, `Verification Detail — Aarya Studio`, `Orders — FADEN Admin`, `Dispute Detail — Case #DS-9021`, `Dispute Detail (Mobile Admin)`, `Settlements — FADEN Admin`, `Audit Log — FADEN Admin`, and `Platform Configuration — FADEN Admin`.

## [x] A01 Build the Admin shell and navigation

**Routes:** `/`, `/boutiques`, `/orders`, `/disputes`, `/settlements`, `/audit`, `/configuration`.

**Files:**

- Add `apps/admin/components/admin-shell.tsx`.
- Add `apps/admin/app/admin.css` or use a scoped existing stylesheet.
- Refactor `apps/admin/app/layout.tsx` and `apps/admin/app/page.tsx`.

**Required UI:**

- Desktop sidebar/top bar and mobile navigation matching Stitch.
- Active navigation state.
- Signed-in admin identity, MFA status and sign out.
- Skip link, landmarks, visible focus and accessible mobile menu.

**Security:**

- Keep middleware role enforcement.
- Every protected page must also verify the user and admin role server-side.
- Sensitive pages and mutations require AAL2.

**Acceptance:**

- Non-admin, unauthenticated and AAL1 sessions are redirected correctly.
- All routes render in desktop and mobile layouts.

## [x] A02 Build the live platform overview

**Route:** `/`.

**Data:** Server-side aggregate counts from existing tables.

**Widgets:**

- Gross marketplace value from captured payments only.
- Active orders.
- Pending boutique verifications.
- Open disputes.
- Settlements awaiting action.
- Payment/shipping/email/Daily readiness, never secret values.
- Recent auditable platform activity.

**Rules:**

- Use one SQL admin-summary RPC instead of many unrestricted client queries.
- Define time ranges explicitly and display IST labels.
- Empty states must show zero, not fabricated numbers.

**Tests:** Admin-only RPC access and aggregation correctness.

## [ ] A03 Build boutique list and moderation actions

**Route:** `/boutiques`.

**Required UI:**

- Search by boutique name/slug/business email.
- Filter by `draft`, `pending_verification`, `verified`, `suspended`, `rejected`.
- Sort and cursor pagination.
- Status, owner, submission date, verification date and risk flags.
- Links to detail pages.

**Mutations:** suspend and reactivate with mandatory reason and confirmation.

**Database:** Add an RPC that validates allowed state transitions, audits every decision and prevents self-service bypass.

**Acceptance:** Search/filter pagination works; state changes are audited; non-admin calls fail.

## [ ] A04 Build boutique verification workflow

**Route:** `/boutiques/[id]/verification`.

**Migration:** `202609010023_boutique_verification.sql`.

**Tables:**

- `boutique_verification_submissions`
- `boutique_verification_documents`
- `boutique_verification_events`

**Required workflow:**

1. Boutique submits legal/business details and documents.
2. Status becomes `pending_verification`.
3. AAL2 admin reviews submitted values and signed document links.
4. Admin approves, rejects, or requests information with a mandatory reason.
5. Decision updates boutique status atomically and writes audit/outbox events.

**Rules:**

- Never expose verification documents publicly.
- Approved snapshots remain immutable even if the boutique later changes its public profile.
- Prevent an admin from approving incomplete required fields.

**Tests:** all transitions, document access, re-submission, unrelated-user denial and audit creation.

## [ ] A05 Build admin order management

**Routes:** `/orders` and `/orders/[id]`.

**Required UI:**

- Search by order number, customer email and boutique name.
- Filter by order/payment/production/shipment status and date.
- Cursor pagination.
- Order timeline assembled from accepted offer, payments, design decisions, production, appointments, shipping, messages metadata and aftercare.
- Display private measurements only behind a separate explicit access action; log that access.
- Admin notes are private from customer and boutique.

**Allowed actions:** safe status inspection, add admin note, open dispute, initiate refund through the dedicated refund workflow. Do not add arbitrary status-edit controls.

**Acceptance:** No direct uncontrolled order status mutation exists; every privileged view/action is authorized and audited.

## [ ] A06 Build disputes and resolution workflow

**Routes:** `/disputes` and `/disputes/[id]`.

**Migration:** `202609010024_disputes.sql`.

**Tables:** `order_disputes`, `dispute_messages`, `dispute_evidence`, `dispute_events`.

**Statuses:** `open`, `awaiting_customer`, `awaiting_boutique`, `under_review`, `resolved_customer`, `resolved_boutique`, `closed`.

**Required behavior:**

- Customer or boutique may open a dispute for an eligible order.
- Evidence uses private `order-files` objects.
- Parties see only their case and non-internal messages.
- Admin sees all evidence and has separate internal notes.
- Resolution records reason, policy basis and proposed financial action.
- Financial action calls the refund service; never mark a refund successful before provider confirmation.

**Tests:** ownership, evidence access, transition validity, internal-note privacy, duplicate-open-dispute prevention.

## [ ] A07 Build settlements and payout ledger

**Routes:** `/settlements` and `/settlements/[id]`.

**Migration:** `202609010025_settlements.sql`.

**Tables:** `ledger_entries`, `boutique_settlements`, `settlement_items`, `payout_attempts`.

**Rules:**

- Ledger entries are immutable and balanced.
- Calculate platform commission, tax, refunds and boutique net amounts in integer paise.
- One captured order amount may be settled only once, adjusted by explicit reversal entries.
- Manual payout marking requires AAL2, external reference, confirmation and audit entry.
- Automated payout integration remains behind a disabled flag.

**Acceptance:** Calculation tests include full refund, partial refund and duplicate settlement attempts.

## [ ] A08 Build audit log interface

**Route:** `/audit`.

**Required UI:** filter by actor, action, target type, date and request ID; cursor pagination; expandable safe before/after values; CSV export generated server-side.

**Security:** AAL2 admin only. Export is audited. Redact secrets and sensitive personal fields.

**Acceptance:** Filters are server-side; large datasets do not load into the browser at once.

## [ ] A09 Build platform configuration

**Route:** `/configuration`.

**Migration:** `202609010026_platform_configuration.sql`.

**Configuration:** commission basis points, request/offer expiry durations, supported appointment types, cancellation windows, maximum upload sizes and public maintenance messages.

**Rules:**

- Secrets do not belong in this table or UI.
- Store typed values with validation and version history.
- Changes require AAL2, confirmation and audit event.
- Code must provide safe defaults when configuration is absent.

**Acceptance:** Invalid types/ranges are rejected in both API and database.

## [ ] A10 Add admin reports and operational tests

**Required reports:** orders, captured payments, refunds, boutique status and settlements by date range. Export CSV with explicit columns and IST timestamps.

**Tests:** Add a complete local admin workflow script covering sign-in prerequisites, verification, order lookup, dispute resolution, settlement creation and audit visibility.

**Acceptance:** Admin Stitch desktop/mobile parity is reviewed and every Admin route has an authorization test.

---

# Phase B — Complete Boutique Studio

## [ ] B01 Complete boutique onboarding and business profile

**Routes:** `/onboarding`, `/settings/profile`, `/settings/business`.

**Required fields:** legal name, display name, description, specialties, business email/phone, address, service areas, years active, price range, turnaround, social links and policies.

**Rules:**

- Separate public boutique profile fields from private legal/verification fields.
- Validate Indian phone/postal formats without assuming every user is in India.
- Public profile edits must not mutate an approved verification snapshot.
- Use address autocomplete only as assistance; allow manual correction.

**Acceptance:** Draft save, validation, submit for verification and read-only pending state all work.

## [ ] B02 Add team invitations and permissions

**Routes:** `/settings/team`.

**Use existing:** `boutique_members` and `boutique_invitations`.

**Roles:** owner, manager, catalog manager, order manager. Map them to explicit permissions rather than trusting labels.

**Required behavior:** invite, resend, revoke, accept, remove and change role. Prevent removing the last owner. Expire invitations. Email invitation through the outbox.

**Acceptance:** RLS and API tests prove staff cannot access ungranted features or another boutique.

## [ ] B03 Add availability and calendar management

**Routes:** `/settings/availability` and existing `/appointments`.

**Migration:** `202609010027_boutique_availability.sql`.

**Tables:** weekly availability rules, date overrides and blocked periods.

**Behavior:** Generate appointment slots within rules, prevent overlaps, support video and in-person modes, provide IST display, and preserve already-booked slots when availability changes.

**Acceptance:** timezone, daylight-neutral IST behavior, overlap and reschedule tests pass.

## [ ] B04 Finish portfolio media and collections

**Routes:** existing `/portfolio` plus `/portfolio/collections`.

**Use:** F03/F04 uploads.

**Required behavior:** multiple images, ordering, cover image, alt text, collection assignment, draft/published/archived state, preview before publish and public page validation.

**Acceptance:** Only verified authorized members can publish; archived designs disappear publicly but remain in Studio.

## [ ] B05 Harden requests and offers

**Existing routes:** `/requests`, `/requests/[id]`, `/offers`, `/offers/new`, `/offers/[id]`.

**Add:** server-side filters/pagination, request expiry, explicit decline reason, offer expiry, offer templates, line items, taxes, alteration count, fitting terms and delivery estimate.

**Rules:** Sent offers are versioned and immutable; revisions create a new version. Closed/revoked shares cannot be used to create offers. Money remains integer paise.

**Acceptance:** Concurrent edits and duplicate submissions are handled with revision/idempotency checks.

## [ ] B06 Activate production workflows safely

**Existing routes:** `/production` and `/orders/[id]/production`.

**Migration:** `202609010028_production_activation.sql` if schema changes are required.

**Required behavior:** replace rehearsal wording, support defined stage transitions, due dates, private/public notes, upload-backed progress images, delay reason and customer-visible updates.

**Rules:** Do not remove the production block until captured payment is verified. Only the order's original verified boutique owner or permitted staff may update production.

**Acceptance:** Invalid stage skipping, unpaid production start and unrelated-boutique access are rejected.

## [ ] B07 Complete fulfilment controls

**Existing routes:** order delivery pages and Shiprocket readiness endpoints.

**Required UI:** delivery address review, package dimensions/weight, serviceability, rate selection, shipment booking, label download, tracking timeline, cancellation and return-to-origin state.

**Behavior before Shiprocket activation:** show configured/readiness status and allow no fake booking.

**Acceptance:** Booking remains idempotent; webhook events can be replayed without duplicate timeline entries.

## [ ] B08 Add performance and financial analytics

**Route:** `/analytics` matching `Performance Analytics — Aarya Studio`.

**Metrics:** request-to-offer conversion, offer acceptance, order value, average response time, on-time milestones, ratings, captured revenue, pending settlement and paid settlement.

**Rules:** Server aggregates only; define every metric in page help text. Never count test payments as live revenue.

**Acceptance:** Date filters and empty states work; boutique can see only its own metrics.

## [ ] B09 Add boutique payouts and documents

**Routes:** `/finance`, `/finance/settlements`, `/finance/invoices`.

**Required UI:** payout readiness, masked bank/payout account metadata, settlement breakdown, downloadable invoices and refund deductions.

**Security:** Never store raw bank credentials. Use provider tokens/IDs. Sensitive changes require recent authentication and notification.

## [ ] B10 Complete Studio responsive parity and tests

Review all Studio routes at 390 px, 768 px, 1280 px and 1440 px. Add browser E2E tests for onboarding, request-to-offer, order production, appointment, delivery and aftercare. Remove all rehearsal/preview wording only from workflows genuinely enabled by flags and tests.

---

# Phase C — Complete Marketplace

## [ ] C01 Complete customer account and preferences

**Route:** `/account`.

**Required sections:** profile, email, linked Google identity, password/security, addresses, measurements, notifications, privacy export and account deletion.

**Rules:** Require reauthentication for email change, identity unlink and deletion. Account deletion must be a scheduled/anonymized workflow when financial/legal retention applies.

## [ ] C02 Complete discovery, search and recommendations

**Routes:** `/discover`, `/designs`, boutique/design detail pages.

**Required behavior:** URL-backed filters, sort, cursor pagination, autocomplete, recent searches, clear filters, no-results suggestions and saved items. Add PostgreSQL full-text/trigram indexes only after measuring query needs.

**Recommendations:** Start with deterministic similarity by category, style, budget and location; do not add an ML service.

## [ ] C03 Complete request drafts and uploads

**Existing routes:** `/create/*`, `/requests`, `/requests/[id]`.

**Required behavior:** upload-backed inspirations, draft auto-save, resume, edit before sharing, archive, duplicate, explicit measurement consent and clear share/revoke controls.

**Rules:** A boutique sees a request only through an active share. Revoking removes future access but preserves legally required order snapshots after acceptance.

## [ ] C04 Complete offers and checkout preparation

**Existing routes:** `/offers`, `/offers/compare`, `/offers/[id]`, `/orders/secure`.

**Required behavior:** display versioned totals, inclusions/exclusions, delivery estimate, fittings, expiry, taxes and cancellation terms. Require final confirmation of amount, address and policies before starting payment.

**Acceptance:** Expired/withdrawn offers cannot be accepted; duplicate acceptance cannot create two orders.

## [ ] C05 Complete order hub and timeline

**Routes:** `/orders` and `/orders/[id]`.

**Required behavior:** unified timeline, next required action, payment state, design approval, appointments, production, delivery, messages and aftercare. Provide downloadable invoice/receipt only from verified financial records.

## [ ] C06 Complete cancellations, refunds and disputes

**Routes:** `/orders/[id]/support`, `/orders/[id]/dispute`.

**Required behavior:** eligibility explanation, cancellation request, evidence upload, dispute timeline and refund status. Never promise a completed refund until provider webhook/API verification.

## [ ] C07 Add legal, help and trust pages

**Routes:** `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`, `/cancellation-policy`, `/measurement-privacy`, `/help`, `/contact`.

**Rules:** Use approved legal copy supplied by the business. Until supplied, label drafts internally and do not invent compliance claims.

## [ ] C08 Complete Marketplace responsive parity and tests

Compare every Marketplace page with its Stitch desktop/mobile reference. Add E2E journeys for sign-in, discovery/save, request draft/share, offer compare/accept, test payment, design review, appointment, delivery, messages and aftercare.

---

# Phase N — Transactional notifications

## [ ] N01 Build outbox email dispatcher

**Use existing:** `outbox_events`.

**Migration:** `202609010029_notification_delivery.sql`.

**Tables:** notification deliveries, attempts and user notification preferences; extend existing preference data instead of duplicating it.

**Behavior:**

- Database transactions enqueue semantic events.
- A server worker/Edge Function claims events with locking.
- Templates render from typed payloads.
- Delivery retries with capped exponential backoff.
- Permanent failures are visible to Admin.
- Idempotency prevents duplicate emails.

**Do not:** send email directly inside a critical SQL transaction or expose SMTP credentials to an app.

## [ ] N02 Implement required email events

Implement and test templates for:

- Welcome and password/security changes.
- Boutique invitation and verification decisions.
- Request shared/revoked and new offer.
- Offer sent, revised, accepted, declined or expired.
- Payment success/failure/refund.
- Design proposal/approval/revision.
- Appointment confirmation, reminder, reschedule and cancellation.
- Production milestone/delay.
- Shipment booked, out for delivery, delivered and exception.
- New private message digest.
- Aftercare/review/dispute events.

Use `faden.in` sender addresses only after domain verification. Include preference handling for optional mail; never allow opt-out from essential security/transaction emails.

## [ ] N03 Add scheduled jobs

Implement idempotent scheduled handlers for offer expiry, request expiry, appointment reminders, shipment reconciliation, stale outbox retries and daily operational summaries. Secure cron endpoints with a server-only secret and log each run without logging user-sensitive payloads.

---

# Phase I — External integrations and activation

## [ ] I01 Activate Razorpay test mode end-to-end

**Prerequisites:** A05, A06, A07, C04, C06 and N01.

**Server environment:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, explicit test-mode enable flag.

**Required behavior:**

- Create Razorpay order server-side from the locked accepted offer/order total.
- Return only public checkout data to the browser.
- Verify checkout signature server-side.
- Verify raw webhook body signature before parsing/processing.
- Store provider IDs and event IDs with unique constraints.
- Treat webhooks as authoritative for captured/failed/refunded state.
- Support replay and out-of-order webhook delivery.
- Add full/partial refund command with admin authorization and idempotency.

**Acceptance:** Use Razorpay test credentials only. Test success, failure, user close, duplicate webhook, invalid signature and refund.

## [ ] I02 Activate Razorpay live mode

Do not perform this ticket until the business explicitly authorizes live payments. Use separate live credentials, production webhook, live readiness check and a small controlled real transaction/refund. Add reconciliation and alerts before broad enablement.

## [ ] I03 Activate Shiprocket test/integration mode

**Prerequisites:** B07 and N01.

**Required behavior:** serviceability, rates, order creation, AWB assignment, pickup, label, cancellation, tracking and webhook verification. Keep provider payloads in a restricted integration log with secrets and unnecessary personal fields removed.

**Acceptance:** Replayed webhook does not duplicate events; failed booking can be retried safely; customer sees normalized FADEN statuses.

## [ ] I04 Activate Daily video sessions

**Prerequisites:** B03 and N01.

**Environment:** Daily API key and existing explicit API/live-room flags.

**Required behavior:** retain current private on-demand rooms, participant authorization, 15-minute-before/30-minute-after join window, short-lived room-bound tokens and recording disabled. Add connection error help and host/guest labels.

**Acceptance:** unrelated users and out-of-window joins fail; customer is not room owner; boutique owner has required room controls; no token is stored.

## [ ] I05 Complete maps and address integration

**Use existing:** Geoapify endpoint if retained; otherwise choose one provider once and remove the unused abstraction.

**Required behavior:** autocomplete, manual correction, structured address, postal-code validation, map preview, boutique directions and shipping serviceability. Restrict provider key by domain/API where supported. Never expose a customer's private address on public pages.

## [ ] I06 Keep phone OTP deferred

No implementation now. Keep `NEXT_PUBLIC_PHONE_AUTH_ENABLED=false`. If later authorized, create a separate plan covering SMS provider cost, Indian DLT requirements, abuse/rate limiting, recovery and identity linking.

---

# Phase Q — Security, quality and production launch

## [ ] Q01 Complete authorization and RLS audit

Create a matrix listing every table/RPC/route and permissions for customer, boutique owner, each staff role, admin and anonymous. Add SQL/API tests for every denial boundary. Remove unused grants. Verify service-role use is limited to trusted server code.

## [ ] Q02 Add security headers and abuse controls

Add CSP, HSTS in production, frame restrictions, MIME sniffing protection, referrer policy and permissions policy. Add rate limits to auth-adjacent, upload, search, message, payment, video and webhook endpoints. Add bot protection to public high-abuse forms without blocking normal accessibility.

## [ ] Q03 Add observability

Add error monitoring, structured request IDs, integration-event status, health checks and uptime monitoring. Redact tokens, cookies, addresses, measurements and provider secrets. Alert on payment webhook failures, shipment sync failures, email backlog and repeated admin authorization failures.

## [ ] Q04 Expand CI/CD

GitHub Actions must run formatting check, lint, typecheck, unit tests, Supabase reset/tests, integration scripts, application builds and all three Docker builds. Add Playwright smoke tests against previews. Keep production deployment gated on CI success and document rollback.

## [ ] Q05 Performance and accessibility pass

Targets:

- No critical WCAG 2.2 AA violations on core journeys.
- Keyboard-only completion of all forms.
- Correct headings, landmarks, labels and error announcements.
- Optimized images and fonts.
- No avoidable N+1 database calls.
- Pagination for unbounded collections.
- Lighthouse performance/accessibility budgets documented and checked on representative pages.

## [ ] Q06 Data lifecycle and recovery

Define retention for accounts, requests, measurements, messages, verification documents, audit events and financial records. Implement user export, deletion/anonymization and expired-upload cleanup. Document backup, restore, migration rollback and incident recovery; perform a restore rehearsal.

## [ ] Q07 Production configuration and domain

Connect `faden.in` only after final checks. Configure canonical URLs, Supabase redirect URLs, Google OAuth origins/redirects, email sender links, Razorpay webhook, Shiprocket webhook and Daily domains. Verify every Vercel production variable without printing secrets.

## [ ] Q08 Launch rehearsal

Run a complete test with separate customer, boutique and admin accounts:

1. Boutique onboarding and admin verification.
2. Portfolio publish.
3. Customer discovery and request sharing.
4. Offer creation, comparison and acceptance.
5. Test payment.
6. Design review and measurement appointment.
7. Production updates.
8. Shipment booking/tracking.
9. Delivery confirmation and aftercare.
10. Dispute, refund and settlement reconciliation.

Record defects as separate tickets. Launch only when no critical/high defect remains and rollback is tested.

## [ ] Q09 Final visual parity review

Capture desktop and mobile screenshots for every implemented route. Compare with all relevant Stitch screens. Fix layout, typography, spacing, responsive behavior, image crop/quality, interaction states and copy consistency. Do not mark complete based only on a successful build.

---

# 5. Environment-variable placement

Never put real values in this document or Git. Add names and descriptions to `.env.example` files and set actual values in local ignored files and Vercel project settings.

| Variable category                     | Marketplace                         | Studio                          | Admin                        | Server-only                           |
| ------------------------------------- | ----------------------------------- | ------------------------------- | ---------------------------- | ------------------------------------- |
| Supabase URL/publishable key          | Yes                                 | Yes                             | Yes                          | No                                    |
| Supabase secret/service key           | Payment/webhook routes only         | Trusted integration routes only | Narrow admin operations only | Yes                                   |
| Google auth display flag              | Yes                                 | Yes                             | Yes                          | No; display only                      |
| Razorpay public key ID                | Yes when checkout enabled           | No                              | No                           | No                                    |
| Razorpay key secret/webhook secret    | Yes                                 | No                              | Admin reads readiness only   | Yes                                   |
| Shiprocket credentials/webhook secret | Readiness/tracking as needed        | Yes                             | Admin reads readiness only   | Yes                                   |
| Daily API key/live flags              | Yes                                 | Yes                             | Admin reads readiness only   | Yes except harmless display flag      |
| Maps provider key                     | Server autocomplete/geocoding route | Server route if needed          | No                           | Prefer yes                            |
| SMTP/email provider credentials       | Worker only                         | Worker only                     | Worker only                  | Yes                                   |
| Cron secret                           | Scheduled handlers only             | Scheduled handlers only         | Scheduled handlers only      | Yes                                   |
| Monitoring DSN                        | As required                         | As required                     | As required                  | Public DSN allowed; auth token secret |

Use three Vercel projects already established for Marketplace, Studio and Admin. Put a variable only in the project that uses it. Use Preview values for client review and Production values for `faden.in`. Do not use production provider credentials in Preview.

# 6. Migration and API conventions

## SQL migration template requirements

Every new migration must:

1. Create/alter objects explicitly.
2. Enable RLS on every new table.
3. Revoke broad privileges before granting required operations.
4. Add policies based on `auth.uid()` and existing ownership/membership relations.
5. Add constraints and indexes for foreign keys, statuses, unique idempotency keys and common filters.
6. Implement guarded state transitions in an RPC when multiple records change.
7. Write an audit/outbox event in the same transaction when required.
8. End with explicit function execute grants.
9. Include a matching `supabase/tests/NNN_*.sql` file.

## Route convention

- `GET`: server component query where possible; API route only when a client refresh needs it.
- `POST`: create or command.
- `PATCH`: limited field update with revision check.
- `DELETE`: soft-delete/archive unless permanent deletion is explicitly safe.
- Return `400` validation, `401` unauthenticated, `403` unauthorized/origin, `404` invisible resource, `409` state conflict, `413` oversized and `503` integration unavailable.
- Do not return raw provider or database error messages to users.

# 7. Cursor prompt template

Paste this prompt into Cursor for each ticket, changing only the ticket ID:

```text
Implement ticket [TICKET_ID] from docs/CURSOR_BUILD_PLAN.md.

Follow only that ticket and the global rules in sections 2, 5 and 6. First inspect all named existing files, the current Supabase schema/RLS, and the matching Stitch screenshot/HTML. Reuse existing patterns and components. Do not start another ticket, do not invent external credentials, do not weaken authorization, and do not edit an existing migration.

Add the specified tests and run all ticket-specific commands plus the global completion gate. Fix failures caused by your changes. When complete, summarize changed files, database/security decisions, test results, and any external configuration that remains disabled. Mark the checkbox complete only if every acceptance criterion passed.
```

# 8. Final completion checklist

The entire FADEN application is complete only when all tickets above are checked and all of the following are true:

- Customer, boutique and admin journeys work with separate authorized accounts.
- Every private record is protected by tested RLS and server authorization.
- No production workflow says rehearsal or preview unless it truly is a public fictional demo.
- Payments, refunds, shipping and settlements reconcile with provider records.
- Email notifications retry safely and are observable.
- Daily sessions enforce participant and time-window access with recording off.
- All Stitch desktop/mobile screens have been reviewed for parity.
- All three Vercel production deployments use `faden.in`-appropriate domains and redirects.
- CI, Docker, Supabase tests and E2E tests pass.
- Monitoring, backups, rollback and incident procedures have been tested.
- Approved legal policies are published.
- No secret exists in Git history, browser bundles, logs or documentation.
