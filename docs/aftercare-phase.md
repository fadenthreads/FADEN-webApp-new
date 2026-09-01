# Private aftercare rehearsal

## Implemented

Migration `202608310016_aftercare_rehearsal.sql` adds private review/alteration items and append-only response history in Supabase, still the only database.

- Customer and Studio `/orders/[id]/aftercare` show order-specific feedback and alteration history. Customer submission requires delivery-rehearsal confirmation, a non-cancelled order, and the original verified/published boutique still owning the order boutique.
- One private rehearsal review per order, with an integer rating from 1–5 and 10–2000 characters of feedback. Reviews cannot be edited or published here. They never update catalog ratings, review counts or public reputation.
- Up to ten alteration requests per order, with only one active request at a time. Initial text remains unchanged; each subsequent action adds an attributed, timestamped event.
- Boutique workflow: requested → accepted or declined; accepted → ready. Customer workflow: requested → cancelled; ready → closed. Accepted work cannot be silently cancelled, and closed/declined/cancelled requests cannot reopen. These are rehearsal statuses, not promises of real service.
- Explicit confirmation is required for every submission/response. Decline/cancel/closure responses require a 10–2000 character note. Notes are shared between the order customer and permitted original boutique owner; avoid private measurements, contact details and addresses.
- Stable command IDs make exact retries idempotent. Expected versions and order locks prevent stale or conflicting updates; partial unique indexes enforce review and active-request limits.
- Completion-screen buttons now open the corresponding review or alteration section. Their layout retains the Stitch action styling. `/preview/aftercare` is a fictional read-only example; its submission controls are disabled.

## Privacy and limits

RLS derives access from the order. Other customers cannot read feedback or event history. Former boutique owners lose access; new owners do not inherit prior feedback. Direct authenticated table writes are revoked, and RPCs recheck actor and allowed state. Cancelled orders are read-only. A customer may close an already-ready request after ownership changes, but new submissions require the original boutique to be available.

All items are constrained to `mode=rehearsal`; event history belongs to those items. The production-mode APIs reject mutations, and the public example is disabled in production. Direct database calls can only create private rehearsal data. Audit/outbox entries contain identifiers, not feedback text. Outbox insertion does not send a message.

No public reviews, moderation system, review correction/deletion, real alteration execution, quote/fee changes, refunds, courier pickups, invoices, email/SMS or chat are implemented by this checkpoint. Completed rehearsal delivery is not verified purchase evidence. Real review publication must wait for verified live orders, moderation, privacy/retention rules and explicit customer publication consent. Rehearsal feedback must never be promoted into genuine reviews.

## Verification

`test-aftercare-workflow.mjs` runs within the existing isolated local fulfilment fixture via `npm run test:designs`, covering roles, delivery eligibility, rating validation, retries, concurrency, transitions, immutable history, ownership transfer and cancelled orders. Authenticated pages are checked through HTTP fixtures without switching the user's browser account. Public desktop/mobile screenshots and completion navigation are reviewed separately. See hosting notes for final release results; no hosted authenticated workflow is claimed tested.

Local checks on 1 September 2026: 48 aftercare checks, 56 fulfilment checks, 73 appointment checks, 43 production checks and 45 design checks passed. The database suite passed 181 assertions across fourteen suites. Lint, TypeScript and formatting checks passed. The public aftercare page was reviewed at desktop and 390px mobile widths without horizontal overflow; completion links open the correct review/alteration sections. Anchor spacing was adjusted for the fixed navigation header.

All seven workspace builds passed; local servers were restarted and all three health endpoints returned 200. Migration 016 was applied additively to staging without fixture import. Hosting notes record the final deployment/anonymous-access checks. GitHub CI includes these tests, but no remote CI run or Git-triggered deployment is claimed.

## Next gaps

- Customer/boutique messaging and notification delivery.
- Audited correction, withdrawal/deletion, disputes and support for ownership changes.
- Moderated public reviews tied to real verified orders, without carrying over rehearsal ratings.
- Alteration pricing/customer approval, time windows, revised measurements with consent, fitting/collection booking, execution and redelivery.
- Return/refund rules, tax invoices, operational queues, role permissions, retention and abuse limits before live activation.

Provider setup and live payments remain deferred. This is not a real aftercare service yet.
