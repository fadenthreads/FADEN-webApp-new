# Offer acceptance & checkout foundation

Follow-up: [Razorpay test payments and unpaid cancellation](test-payments-review.md) now supersede the payment-disabled and cancellation-unavailable statements below. This document records the earlier foundation phase.

## Delivered

The next slice after offers is implemented: explicit acceptance, an immutable commercial order record, customer orders and the Stitch **Secure Your Order** checkout layout. Supabase remains the only database.

- Customer: `/offers/[id]` → confirm terms → `/orders/secure?id=…`; `/orders` and `/orders/[id]` retain the accepted quote, totals, advance, balance and acceptance date.
- Studio: `/orders` and `/orders/[id]` show the original accepted quote, awaiting payment. Navigation connects requests, offers and orders.
- The checkout uses source `5fa34159`: centered 672px canvas, Syne/Karla typography, white summary card, terracotta advance panel and full-width action. Copy deliberately differs where the mockup would otherwise falsely imply payment is available.
- This is an unpaid preview: accepting fixes the chosen offer for that request. Cancellation and amendments are **not yet available**, and the confirmation explains this before acceptance.

## Boundaries

Razorpay is not connected. The payment button is disabled. No payment intent, card collection, charge, receipt, email, production job, fitting booking or shipment is created. Zero advance is not treated as paid. All records remain `awaiting_payment`.

The Studio order page is a functional commercial snapshot, not a completed replica of the future production/order-management screen. Customer and Studio populated-order HTML is tested through authenticated HTTP requests; populated checkout screenshot comparison and owner visual sign-off remain pending. Browser review uses the user's existing account, without changing its login, and covers the empty order state at desktop and mobile widths.

## Database & security

Migrations `202608300007_order_acceptance.sql` and `202608300008_order_rpc_permissions.sql` add `customer_orders`, accepted offer status and an authenticated acceptance RPC. Anonymous execution is explicitly revoked, including Supabase's inherited default grant.

Acceptance locks the parent request before its share and offer. Concurrent retries return the same order; competing offers produce one winner. It rechecks ownership, consent, sent status, version, expiry, completion date, active sharing and verified/published boutique availability. Prices come only from the stored quote. Unique request and offer constraints provide a second duplicate guard.

RLS permits the customer and original, still-verified boutique owner to read the snapshot. A new owner does not inherit it. Authenticated clients cannot insert, update or delete order records directly, or mark them paid. The snapshot excludes the private request, addresses, measurements and inspiration. Revoking a brief removes new brief reads but does not cancel an accepted order or erase its commercial quote.

One identifier-only `order.accepted` outbox event is recorded. No notification dispatcher exists yet. Application writes use an authenticated Supabase client with same-origin checks, not a service credential.

## Verification & CI

- Six pgTAP suites: 81 assertions, including 12 order permission/constraint checks.
- `npm run test:orders`: 39 local HTTP/database checks covering auth, cross-origin writes, consent, stale/expired/unavailable offers, exact snapshots, duplicate and competing acceptance, private URLs, boutique ownership changes, revocation, zero advance and one outbox event.
- Test records are isolated local fixtures and removed afterward. Existing customer/demo data and pending Aarya onboarding are preserved.
- CI runs the order suite after marketplace/request/offer integration tests against Marketplace and Studio production servers. Existing Docker builds remain unchanged. Remote CI requires a later commit/push and has not been run by this phase.
- Final verification passed: formatting, lint, TypeScript, all three production builds, plus 39 order / 32 offer / 24 request / seven marketplace integration checks against both development and production servers. The existing `npm test` workspace scripts are smoke placeholders; the meaningful behavioral coverage is in the database and HTTP suites above.
- Local Node 20 emits a Supabase deprecation warning; the project and CI target Node 22. No dependency or runtime migration was performed in this phase.

## Resume here

Next, implement cancellation/amendment rules for unpaid orders and the Razorpay **test-mode** payment adapter: server-created orders based on saved amounts, idempotent attempts, verified checkout signatures and webhook signatures, captured-payment reconciliation, duplicate/out-of-order webhook tests, failure/retry states and receipts only after verified success. Follow [Razorpay's Standard Checkout documentation](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

Test credentials and webhook setup are required before gateway verification; merely adding credentials will not enable payments in this version. Store secrets server-side; never in browser variables or source control. Live payments require a separate readiness decision, merchant setup and verification.

Then proceed to design approval, production journey, fitting coordination, address confirmation, courier booking/tracking and completion screens. Production readiness still requires pagination, rate limits, notification dispatch, observability, support/dispute workflows and a retention/deletion policy.
