# Measurement appointments — reservations, outcomes and follow-ups

## Implemented

Supabase remains the only database. Migration `202608310013_measurement_appointments.sql` adds private availability, appointment history and restricted booking functions.

- Studio `/appointments`: publish video or in-person boutique slots, see upcoming confirmed bookings, cancel a booking, and withdraw an unbooked slot. Addresses are entered by the boutique; no map/geocoding provider is connected.
- Customer `/orders/[id]/appointments`: select a permitted slot, explicitly confirm a reservation, atomically reschedule, cancel, and see private appointment history. Linked from order details.
- `/preview/appointments`: fictional customer example, no account required, booking controls disabled. Existing FADEN typography, palette and spacing are reused: no dedicated appointment screen was present in the supplied Stitch export.
- Booking is **order-bound** in this slice, not part of the pre-offer request wizard. Customer design approval is not required: taking measurements may precede design approval.
- Date input and display use India time (IST); timestamps are stored as timezone-aware UTC instants. API creation requires an explicit offset. Slots must start at least 15 minutes ahead, within 90 days, and last 15–120 minutes (UI offers 30/60 minutes). Booking closes five minutes before the start.
- One schedule per boutique owner, including their different boutiques; overlapping slots are rejected. A customer cannot have overlapping confirmed appointments across orders. One confirmed appointment per order; rescheduling retains the replaced booking.
- Failed rescheduling keeps the original appointment. Booked slots cannot be withdrawn until the reservation is cancelled. Cancelling an order automatically cancels its future confirmed appointment and releases the slot.

## Outcome and follow-up checkpoint

Migration `202608310014_appointment_outcomes.sql` adds `completed` and `no_show` outcomes with a recorded timestamp and owner attribution. Only the original owner who still owns the verified boutique can record an outcome, after the scheduled end. Explicit confirmation is required. The same outcome can be retried safely without duplicate audit/outbox records; a different outcome cannot overwrite it. No-show records do not create fees, penalties or reputation changes.

Studio defaults to **Awaiting outcome**, with separate **Upcoming / in progress** and **History** views. Booking views use stable ordering and 20-row pagination; availability still shows at most 100 future slots. A completed/no-show session leaves the historical slot booked, but frees the order for a new customer-confirmed reservation.

Follow-ups are linked automatically to the latest completed/no-show session on the same order. Rescheduling carries that follow-up context forward. Customers retain the complete order history (up to the existing 50-row limit). An ended session awaiting an outcome still blocks replacing it until the boutique records what happened. Outcomes are not measurement validation, attendance independently verified by a video provider, payment confirmation, or customer acceptance of final fit.

## Preview boundary

Every reservation is `mode=preview` in the database. Application mutation routes and public sample pages are disabled in `NEXT_PUBLIC_APP_ENV=production`. Direct RPCs still only create labelled preview reservations, not live meeting/service bookings. No money is collected, no video room is created, no email/SMS is sent, and no measurements are shared or modified. Outbox records are identifiers only, not proof that a reminder was delivered.

Video booking type is available and the Daily private-room adapter is prepared, but joining calls remains disabled until protected provisioning/join routes and credentials are activated. In-person reservations are at the boutique only; server-only structured venue storage is prepared in migration 020. Home visits and consented staff measurement updates remain later work. See [measurement session integrations](measurement-session-integrations.md).

## Privacy and concurrency

Slots are readable only by the permitted owner, their eligible order customers, and customers whose booking references that slot. Customer bookings are private; the original owner must still own the verified boutique. New owners do not inherit prior appointment history. RLS and revoked direct-write grants prevent clients from forging status or moving slot times.

RPCs serialize the customer's reservations and the owner's availability, lock the order, then validate current slot and appointment state. Unique active-slot/order indexes add a second constraint. Stable submission IDs make retries idempotent; a reused ID with different details is rejected. Cancellation requires explicit confirmation. There is no public availability directory, service-role application endpoint, or automatic calendar export.

## Verification

`npm run test:designs` now includes 73 appointment checks alongside 43 production and 45 design checks. These use isolated local fixture accounts and remove their records afterwards. Tests cover same-slot races, overlapping customer bookings, retry keys, atomic reschedule failure, cancellation, privacy, owner transfer, forged writes and order-cancellation cleanup. Outcome checks cover future/in-progress rejection, owner-only access, ownership changes, attributed outcomes, immutable/idempotent recording, identifier-only outbox events, concurrent conflicting outcomes, follow-up links and rescheduling continuity. The existing CI job includes them; no remote CI execution is implied.

Database suite: 165 assertions across twelve suites. Authenticated booking screens are checked over HTTP rather than switching the user's browser account. Public desktop/mobile samples are used for visual checks.

Release checks on 31 August 2026: lint, type checking, all seven workspace builds and the existing 62 order/payment checks passed. The public sample was checked at desktop and 390-pixel mobile widths with no horizontal overflow. A duration-label hydration mismatch was corrected and the refreshed preview verified. The local Marketplace, Studio and Admin servers were restarted after the build.

Migration 013 was applied additively to the linked staging database, with no seeds, local accounts or reset. Hosted deployment details are recorded in [Vercel staging notes](vercel-staging.md). Hosted authenticated booking and provider delivery still require end-to-end acceptance; local fixture tests are not proof of those integrations.

Outcome checkpoint verification (31 August 2026): the expanded 73 appointment, 43 production and 45 design checks passed, as did 165 SQL assertions, lint, TypeScript, formatting checks for changed files and all seven workspace builds. The public follow-up/history example was checked at desktop and 390-pixel mobile widths. All three local health endpoints returned 200 after restarting. Migration 014 was applied additively to staging without fixture data or account imports. Video, email/SMS and real appointments remain unconfigured.

## Remaining work / next slice

- Audited outcome correction/disputes and support for sessions stranded by boutique ownership changes. Outcomes are final in this version; do not activate for real appointments until correction/support handling is available.
- Staff-specific calendars, recurring availability, buffers, cancellation cut-offs, global search and availability expiry management. Studio availability lists up to 100 future slots; each order retains up to 50 booking-history rows.
- Pre-order measurement appointments, home-visit serviceability/addresses, verified boutique locations and customer-approved measurement updates.
- Configured video provider, secure meeting links, email/SMS reminders and delivery monitoring; select providers before external actions are enabled. Recordings must remain off unless explicit consent and retention policies are added.
- Real appointment activation and end-to-end acceptance, accessibility review of authenticated forms, rate limits/abuse controls and retention/deletion policy. Live payments remain last.
