# FADEN Early-Stage Startup Launch Plan

This document is the execution source of truth for the first production launch of FADEN. It intentionally replaces the remaining enterprise-sized scope in `CURSOR_BUILD_PLAN.md` with a smaller, secure launch scope. The original plan remains the post-launch backlog.

## 1. Launch product

FADEN launches as an India-first custom luxury-fashion marketplace with:

- Marketplace (`apps/marketplace`): customer discovery, requests, offers, payments, order tracking, appointments, messaging and aftercare.
- Boutique Studio (`apps/studio`): onboarding, verification, requests, offers, design approval, production, appointments, messaging and manual fulfilment.
- Platform Admin (`apps/admin`): boutique verification, order visibility, manual shipping coordination, support notes, refunds and operational oversight.
- Supabase: the only application database, authentication and file storage provider.

### Manual shipping decision

Shiprocket and all automated courier booking are excluded from launch. After a payment is captured, the order appears in an Admin fulfilment queue. An Admin arranges the courier outside FADEN, then records the courier name, tracking number, optional tracking URL, shipment status and timestamps. Customers and boutiques see the normalized tracking timeline.

Never fabricate a booking, AWB, pickup or carrier event. Manual entries must identify the Admin actor and be audited.

## 2. Current status

Completed and deployed:

- F01–F05: integration readiness, API guards, storage, uploads and audit service.
- A01–A03: Admin shell, live overview and boutique list/moderation.
- Supabase auth, Google OAuth hooks, Admin MFA, email/SMTP configuration.
- Customer request, offer, test checkout, design review, production, appointment, messaging, fulfilment rehearsal and aftercare foundations.
- Daily, Razorpay, maps and Shiprocket readiness foundations. Live integrations remain disabled.
- GitHub Actions, Docker builds, Vercel deployments and health endpoints.

Not launch-ready yet:

- Boutique verification is incomplete.
- Admin cannot fully inspect orders or manage manual shipping.
- Several customer and Studio flows still contain rehearsal/preview behavior.
- Production Razorpay payments/refunds are not active.
- Transactional email dispatch is incomplete.
- Rate limiting, monitoring, legal pages and full launch E2E coverage are incomplete.

## 3. Instructions for Terra in light mode

Execute exactly one ticket at a time and stop. Do not infer the next ticket.

For every ticket:

1. Read this document, the named ticket and every existing file it references.
2. Inspect current migrations, generated types, RLS policies and shared helpers before adding code.
3. Read the relevant Stitch screenshot and HTML before editing UI.
4. Reuse existing components and tokens.
5. Add only append-only migrations using the next available migration number.
6. Never edit a migration already applied to hosted Supabase.
7. Add the specified tests; a skipped required test means the ticket is incomplete.
8. Run the ticket gate and global gate.
9. Mark the ticket `[x]` only when all acceptance criteria pass.
10. Do not commit, push or apply hosted migrations. Report results for review.

For every completion report include changed files, schema/RPC changes, authorization decisions, test results, skipped tests, remaining flags and known limitations.

## 4. Non-negotiable launch rules

- Supabase is the only database.
- Browser code may use only public Supabase URL/publishable-key values.
- Service-role, Razorpay, SMTP and Daily secrets remain server-only.
- Every table has RLS, explicit grants and authorization tests.
- Every mutation rechecks authorization in SQL or trusted server code.
- Cookie mutations require same-origin validation and bounded validated bodies.
- Admin-sensitive reads and mutations require Admin role plus MFA AAL2.
- Money is integer paise. Timestamps are `timestamptz` and displayed in IST.
- Payment webhooks, not browser callbacks, are authoritative.
- Provider operations and state transitions are idempotent.
- Store Storage object keys, never expiring signed URLs.
- Never expose measurements, addresses, verification documents or internal notes publicly.
- Never return raw database/provider errors to the browser.
- Never log secrets, cookies, payment signatures, addresses, measurements or document contents.
- Phone OTP, Daily recording, automated shipping and automated payouts remain disabled.

## 5. Launch tickets

### [x] L01 Complete lean boutique verification

**Goal:** Allow a boutique owner to submit business verification and an AAL2 Admin to approve, reject or request changes.

**Routes:** Studio `/verification`; Admin `/boutiques/[id]/verification`.

**Data:** Add verification submissions, document references and immutable events. Reuse the private `verification-documents` bucket.

**Owner flow:** save draft, attach approved document types, submit, view status/reason, resubmit after changes requested. Only the boutique owner may submit; staff may not.

**Admin flow:** view submitted snapshot and short-lived signed document links; approve, reject or request changes with confirmation and a mandatory reason.

**Rules:** approved snapshots are immutable; Admin cannot upload owner documents; approval sets the boutique to verified but does not auto-publish; every transition writes audit and outbox events; suspended boutiques cannot be approved.

**Minimum required fields:** legal name, business type, registration/tax identifier as applicable, registered address, representative name/role, business email/phone and declaration version.

**Tests:** owner/staff/unrelated-user boundaries, AAL1/AAL2 Admin boundaries, document access, incomplete submission rejection, optimistic concurrency, all decisions, resubmission, immutable snapshots, audit and outbox creation.

**Done when:** a real local owner can submit and a real local AAL2 Admin can decide through both desktop and mobile UI with no skipped tests.

### [x] L02 Build Admin order operations and manual shipping queue

**Goal:** Every accepted or paid order is visible to Admin; every captured order requiring fulfilment appears in a manual shipping queue.

**Routes:** Admin `/orders`, `/orders/[id]` and `/orders?queue=shipping`.

**List:** search by order ID, customer email and boutique; filter by order, payment, production and manual-shipment status; date filters; stable cursor pagination.

**Detail:** accepted offer snapshot, monetary totals, payment attempts, design decisions, production milestones, appointments, message metadata, delivery address behind explicit audited access, aftercare and a unified timeline.

**Manual shipping data:** one shipment per order for launch, carrier name, tracking number, optional HTTPS tracking URL, status (`awaiting_arrangement`, `booked`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `cancelled`), Admin note, shipped/delivered timestamps and version.

**Actions:** claim/unclaim fulfilment, add private Admin note, reveal address with reason, record/update manual shipment and mark delivery only with confirmation. No arbitrary order-status editor.

**Rules:** captured payments create/qualify the queue item idempotently; existing unpaid orders remain visible but cannot ship; changes use row locks/version checks; tracking updates write audit, timeline and outbox events; customer/boutique cannot change Admin shipping records.

**Tests:** Admin authorization, private-note isolation, address-access audit, captured/unpaid queue behavior, duplicate queue prevention, shipment transitions, invalid URL/tracking data, concurrency and customer-visible normalized timeline.

**Done when:** Admin can identify every paid order and coordinate shipping manually without Shiprocket.

### [x] L03 Finish Boutique Studio launch workflow

**Goal:** Remove rehearsal behavior from the boutique path required to fulfil an order.

**Routes:** existing Studio requests, offers, orders, design, production, appointments, messages, delivery and portfolio routes.

**Required journey:** verified boutique receives shared request → sends immutable offer → customer accepts/pays → boutique uploads design → customer approves/requests changes → boutique records production stages with progress images → appointment/video measurement works → boutique messages customer → boutique sees Admin-entered shipping status → completes order/aftercare.

**Rules:** only verified and authorized boutique members act; define minimal roles only if already supported; unpaid orders cannot enter production; invalid stage skipping is rejected; sent offers and accepted snapshots remain immutable; every transition is idempotent and audited where significant.

**Scope exclusions:** team invitation UI, advanced availability engine, analytics, finance dashboards, automated payouts and automated courier booking.

**Tests:** one full Studio HTTP journey, unrelated boutique denial, staff permission denial, unpaid production denial, stage-transition validation, upload persistence and responsive UI checks.

### [ ] L04 Finish customer launch workflow

**Goal:** Make the customer journey complete with real Supabase data and no rehearsal pages.

**Required journey:** sign in → browse/save → submit request with inspiration and measurement consent → share with up to allowed boutiques → compare/accept offer → confirm address/policies → pay in test mode → order hub → design decision → appointment/video → production timeline → messages → manual shipment tracking → completion and aftercare.

**Required account features:** profile, saved structured addresses, measurements, Google identity visibility, password recovery and sign out. Phone OTP remains disabled.

**Rules:** private request data is visible only through explicit active shares; address and measurements are never public; duplicate acceptance creates one order; expired/withdrawn offers cannot be accepted; receipts use verified payment data only.

**Tests:** complete customer HTTP journey, share/revoke boundaries, duplicate acceptance, invalid/expired offers, private data isolation, mobile layouts and accessible forms.

### [ ] L05 Implement essential transactional email delivery

**Goal:** Reliably deliver launch-critical email using the existing outbox and configured SMTP.

**Implement:** a worker/secure scheduled endpoint that claims outbox events with locking, renders allowlisted templates, records delivery attempts, retries transient failures with a cap and prevents duplicate sends.

**Required emails:** account security/recovery, verification submitted/decision, request shared, offer received, order created, payment success/failure/refund, design decision needed, appointment confirmation/reminder/change, production delay, manual shipment update, delivery and aftercare.

**Rules:** never send inside a critical SQL transaction; essential transactional messages cannot be disabled; no sensitive measurements/documents in email; links use configured canonical URLs; SMTP secrets remain server-only.

**Tests:** template validation, idempotency, claim locking, retry/permanent failure, safe payloads and Admin-visible failed delivery state.

### [ ] L06 Complete Razorpay test-mode payments and refunds

**Goal:** Prove the financial workflow end to end before live activation.

**Implement:** server-created Razorpay orders from locked accepted totals, checkout signature validation, raw webhook signature validation, provider event-id uniqueness, captured/failed/refunded states, replay/out-of-order handling, receipts and AAL2 Admin full/partial refund command.

**Rules:** webhooks are authoritative; never trust browser amount/status; refunds remain pending until provider confirmation; use integer paise and idempotency keys; do not mix test and live IDs; shipping queue eligibility requires confirmed capture.

**Tests:** success, failure, close, duplicate checkout, invalid signature, duplicate/out-of-order webhook, full/partial refund, refund failure and reconciliation mismatch.

**Activation:** keep live Razorpay disabled after this ticket.

### [ ] L07 Add basic support, cancellation and refund handling

**Goal:** Give customers and Admin a safe early-stage support workflow without building a complex dispute platform.

**Routes:** Marketplace `/orders/[id]/support`; Admin order-detail support section.

**Data:** support cases, customer-visible messages/events and separate private Admin notes. Minimal statuses: `open`, `awaiting_customer`, `awaiting_boutique`, `resolved`, `closed`.

**Actions:** customer requests cancellation/help; Admin records decision and may call only the dedicated Razorpay refund command. Never directly mark money refunded.

**Scope exclusions:** evidence bundles, arbitration, policy automation, SLA engine and advanced dispute reporting.

**Tests:** ownership, internal-note privacy, duplicate open-case behavior, transitions, refund linkage and audit creation.

### [ ] L08 Add launch legal and trust pages

**Routes:** `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`, `/cancellation-policy`, `/measurement-privacy`, `/help`, `/contact`.

**Rules:** business-approved content is required before production. Code may include clearly marked review-required drafts but must not invent legal promises. Record accepted policy version and timestamp at request submission/checkout where required.

**Manual shipping language:** explain that FADEN/Admin coordinates courier fulfilment manually and tracking is provided after arrangement; do not claim automated carrier booking.

**Tests:** routes, navigation/footer links, policy-version persistence and accessibility.

### [ ] L09 Apply baseline production security

**Goal:** Add proportionate early-stage protection without enterprise complexity.

**Implement:** authorization matrix, RLS/RPC/route denial tests, CSP, HSTS in production, frame protection, MIME-sniff protection, referrer/permissions policy, request IDs, input/body limits, upload restrictions and basic rate limits for auth-adjacent, search, upload, message, payment, refund, video and webhook endpoints.

**Secrets:** inventory environment variable names only; verify no secret is committed or exposed to client bundles; rotate any secret previously pasted into chat or source.

**Data:** redact addresses, measurements, tax IDs, tokens, cookies and provider payload secrets from logs/errors.

**Tests:** header assertions, rate-limit allow/deny/reset, permission matrix, service-role usage audit and dependency audit. Document accepted low-risk dependency findings; do not use destructive automatic upgrades.

### [ ] L10 Add monitoring, backups and operational visibility

**Goal:** Ensure failures are noticed and recoverable.

**Implement:** Sentry free tier or equivalent for all three apps, environment/release tagging, source maps kept private, structured request IDs, uptime monitoring for health endpoints and Admin visibility for failed payments, failed emails and stuck shipping queue items.

**Supabase:** confirm automatic backup availability for the selected plan; document manual backup/restore procedure and perform one local restore rehearsal. Never claim point-in-time recovery if the plan does not provide it.

**Alerts:** payment webhook failures, email backlog, repeated Admin authorization failures and orders awaiting manual shipping beyond a defined threshold.

**Tests:** deliberate captured test errors, redaction verification, health checks and restore rehearsal notes.

### [ ] L11 Add critical E2E, accessibility and performance gates

**Goal:** Protect the flows that generate revenue and expose sensitive data.

**Playwright journeys:** customer request/offer/payment; boutique verification; Studio fulfilment; Admin manual shipping; refund/support; role-denial redirects.

**Viewports:** 390, 768, 1280 and 1440 pixels for core pages.

**Accessibility:** no critical automated violations; keyboard completion; correct focus/dialog behavior; labelled fields; announced errors; headings and landmarks.

**Performance:** optimized images/fonts, no avoidable N+1 queries, pagination on unbounded lists and documented Lighthouse budgets for representative pages.

**CI:** run a reliable smoke subset on every push and the full suite before production deployment. Keep all three Docker builds.

### [ ] L12 Production configuration and launch rehearsal

**Goal:** Prepare a controlled production launch.

**Configure:** `faden.in`, canonical URLs, Vercel production variables, Supabase allowed redirects/site URL, Google OAuth origins and redirect URIs, email sender links, Razorpay webhook URL and Daily allowed domains. Shiprocket variables remain disabled and optional.

**Rehearsal:** use separate customer, boutique and Admin accounts to complete verification, portfolio publishing, request sharing, offer acceptance, Razorpay test payment, production, design decision, appointment, messaging, manual shipping, delivery, aftercare, cancellation/refund and audit review.

**Verify:** database backup, rollback documentation, monitoring alerts, support contact, legal approval, mobile/browser checks and zero secrets in logs.

**Launch gate:** enable live Razorpay only after the business explicitly approves it and a controlled real payment plus refund succeeds. Keep automated shipping, phone OTP, Daily recording and automated payouts disabled.

## 6. Global ticket gate

Run after every ticket:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

When SQL changes:

```bash
npx supabase db reset
npm run supabase:test
npm run supabase:types
```

When a complete journey changes, run the relevant local apps and focused HTTP/E2E test. Required tests may not be silently skipped.

## 7. Launch definition of done

FADEN is ready for a controlled early-stage launch only when:

- A boutique can be verified and complete a real order workflow.
- A customer can pay, track and receive support without rehearsal behavior.
- Every captured order appears in the Admin manual shipping queue.
- Admin can record tracking and the customer/boutique can see it.
- Refund status reflects Razorpay-confirmed state.
- Essential emails are idempotent and failures are visible.
- Core authorization, rate-limit, E2E, accessibility and security-header tests pass.
- Monitoring, backup instructions, legal pages and support contacts are active.
- GitHub CI, Vercel deployments and all health checks pass.

## 8. Explicit post-launch backlog

- Shiprocket or other courier API integration.
- Automated AWB, pickup, label and carrier-webhook processing.
- Automated boutique payouts and full settlement ledger.
- Advanced disputes/evidence/arbitration.
- Team invitation and granular staff administration.
- Advanced calendar availability.
- Analytics and reports.
- Phone OTP.
- Daily recording.
- Loyalty, referrals and native mobile apps.
