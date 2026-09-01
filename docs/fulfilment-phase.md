# Delivery details, shipment rehearsal and completion preview

## Implemented

Supabase remains the only database. Additive migration `202608310015_fulfilment_rehearsal.sql` adds private delivery details, immutable shipment rehearsal events and a customer delivery-rehearsal confirmation.

- Customer `/orders/[id]/delivery`: enter an Indian recipient/address and +91 mobile number, explicitly consent to sharing these details with the order boutique, edit before packing rehearsal, view shipment history and confirm the final rehearsal milestone.
- Studio `/orders/[id]/delivery`: read the customer's confirmed delivery details and record the current or next rehearsal stage. Linked from Studio order details.
- Stages: packed → handover → in transit → out for delivery → delivered. These labels are always inside a clearly identified rehearsal workflow; no courier events are received or sent.
- First and subsequent updates require the latest customer design approval, ready-for-fitting production rehearsal and customer-confirmed delivery details. These are rehearsal gates, not authorization to dispatch real goods.
- Address updates use an expected revision, stable command ID and order lock. Packing pins the address revision with a database foreign key and stops edits. Addresses are format-checked only and explicitly **unverified**. Country support is India only in this slice.
- Shipment history uses expected sequence numbers and idempotent command IDs, with at most 30 entries per order. Stages cannot skip or reverse; additional same-stage notes are possible until customer confirmation. Notes are customer-visible and should not contain address, tracking or measurement data.
- Only the customer can explicitly confirm the final delivered rehearsal event. Confirmation is idempotent and closes further shipment history updates. It does not confirm actual receipt, final fit, payment or completion of a real commercial order.
- Customer `/orders/[id]/complete` is gated by that confirmation and a non-cancelled order. It uses an existing private progress photo, if available, through a five-minute signed URL; no sample garment is substituted for a customer's actual photo.
- Public `/preview/delivery` and `/preview/complete` are fictional, read-only examples with no login required in local/staging. They are disabled in production mode.

## Stitch fidelity

The completion screen follows `544fb94a` (Made Especially for You): suppressed main navigation, Syne headline, original terracotta-suit photograph (`asset-084`), offset image frame, two-column action area and dark FADEN footer. It is responsive at 390px. Truthful rehearsal notices and unavailable-action labels are deliberate differences, not pixel-parity claims. Owner visual approval is still required.

Follow-up: review and alteration buttons now open the private [aftercare rehearsal](aftercare-phase.md). Public reviews and real alteration work remain disabled. Invoice downloads, messaging and footer information destinations are still not implemented; their controls remain disabled or non-interactive and labelled. “Start another outfit” opens the existing request wizard, not an automatic copy/reorder.

## Privacy and safety

- RLS inherits existing customer/original verified boutique-owner order access. A new boutique owner does not inherit prior addresses or shipment history; the previous owner loses access.
- Direct authenticated writes are revoked. Scoped RPCs validate actor, confirmation, current order and transition state. Cancelled orders retain read-only history and cannot receive mutations or show completion.
- Audit and outbox entries contain identifiers only, never delivery addresses. The address is stored separately from the immutable quote. Address changes before packing replace the current address rather than duplicating historical PII.
- Every new record is constrained to rehearsal/unverified mode. Production-mode application mutation APIs return 503. Direct RPCs still create rehearsal-only records, not real fulfilment. Commercial order/payment status is unchanged.
- No maps calls, serviceability checks, courier requests, AWBs, labels, scheduled pickups, emails/SMS, charges, invoices or real delivery acknowledgements occur.

## Verification

Local fixtures only: 56 fulfilment checks cover actor/privacy boundaries, required sharing confirmation, address validation, stale revisions, address locking, design/production gates, shipment transitions, competing updates, retry safety, customer-only confirmation, completion gating, owner transfer and cancellation. Existing 73 appointment, 43 production and 45 design checks also pass via `npm run test:designs`. Fixtures are cleaned up; no local accounts or sample records are imported into staging.

SQL suite: 174 assertions across thirteen suites. Lint and TypeScript checks pass. Browser review covers public completion/delivery examples and navigation at desktop/mobile widths; populated authenticated forms are covered by HTTP workflow checks, not signed-in browser acceptance.

All seven workspace builds passed. Changed UI/test formatting checks pass. Local apps were restarted after the build and all three health endpoints returned 200. Migration 015 was applied to staging without reset or fixture imports; deployment and hosted smoke-check status is recorded in the hosting notes. No hosted authenticated fulfilment journey is claimed tested.

## Still required before real fulfilment

- Maps/address validation, courier serviceability and selection, server-side provider credentials, booking idempotency, webhook signature verification, shipment labels, pickups, live tracking and reconciliation/retry jobs.
- Payment clearance, final fitting/quality approval and explicit operational authorization. Rehearsal history must never be promoted into evidence of real manufacture or delivery.
- Address correction after packing, audited milestone correction, failed delivery/return-to-origin, lost parcels, partial/split shipments, cancellations and ownership-change support.
- Live customer receipt/final-fit acceptance, reviews, alterations, returns, refunds, tax invoices, messaging and notification delivery.
- Retention/deletion policy for addresses and notes, abuse controls, staff access, accessibility and hosted end-to-end acceptance. Existing private data remains stored until a dedicated retention workflow is implemented.

Live payments remain last. See [hosting status](vercel-staging.md).
