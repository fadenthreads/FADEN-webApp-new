# Boutique invitations and offers — phase checkpoint

## Delivered

- Submitted customer requests now have an explicit boutique invitation form. A customer can invite up to three verified, published boutiques with an owner, independently selecting whether to include measurements and inspiration.
- A consented snapshot contains the customer's display name and an allowlist of brief fields. Private drafts, reusable measurement profiles and future private fields are not exposed. The interface warns customers to check their free-text notes before sharing.
- Sharing permissions are fixed per invitation. Revoke stops new boutique reads and withdraws outstanding offers; already downloaded data cannot be recalled and existing signed image URLs remain valid for up to 15 minutes. Re-inviting a revoked boutique requires a new request in this version.
- Boutique owners have an inbox, shared-request detail, private atelier notes, itemized offer composer, draft preview, sent-offer detail and withdrawal. Staff access is deliberately not granted yet.
- Quote amounts are integer paise, quantities are integers, tax uses basis points and is rounded once to paise. The database—not a submitted browser total—calculates subtotal, tax and total. Advance cannot exceed total. Tax rates are entered by the boutique, not inferred by FADEN.
- Quotes require title, line items, positive total, completion and expiry dates, and terms before sending. Draft saves use version checks; sent quotes lock. Identical send retries return the same offer without duplicate events.
- Customers can view sent offers, compare up to three active offers for the same request, inspect full line items/terms and decline. Expired quotes are labelled and excluded from active comparison. No invented ratings, “best value” recommendation or order/payment success state.
- Studio overview now uses actual request/offer counts instead of sample metrics. Existing Aarya Studio onboarding was not reclassified as verified.
- Local demonstration data has two clearly named **Demo** boutiques, a fictional reception brief and two proposals. It belongs to `customer@faden.local`, not the user's phone account. No personal measurements were included. `npm run demo:offers` is local-only and does not run in CI.

## Stitch mapping

- Request Detail (`6270143f`): Studio shared-request detail, vision/inspiration panels and measurement/timeline sidebar.
- Compose Offer (`47e2d1cb`): contextual request panel, line-item editor, terms/dates, totals and sticky save/send controls.
- Your Offers (`8dfb0427`, mobile `943c22f6`): editorial heading, asymmetric cards and responsive stacking.
- Offer Detail (`caf17354`): despite the exported studio name, its content is customer-facing (“Your offer from…”). Implemented at customer `/offers/[id]`; Studio also has a functional quote preview.
- Compare Offers (`766aa5a2`): side-by-side scope/price/date/advance/terms cards. Real data is authoritative; no invented quality badges.
- Original source imagery remains local where catalog URLs match the Stitch asset manifest. Offer images identify the boutique, not fabricated customer artwork. Demo photography is illustrative.

This is a functional design implementation pending owner visual sign-off, not a claim of pixel-perfect parity across all Stitch exports. Messaging, fittings, revisions, and choose/pay buttons from the mockups are intentionally not simulated.

## Schema and security

Additive migration `202608300005_request_offers.sql` creates `request_shares`, `boutique_offers` and `atelier_request_notes`. RLS isolates customer snapshots, boutique access and internal notes. Table writes for sharing/offers are revoked; narrow authenticated RPCs enforce consent, ownership, immutable sent quotes and lifecycle transitions. New inspiration reads additionally require matching customer/request path plus an active consenting invitation.

Application endpoints use authenticated Supabase clients, never a service-role credential. They enforce same-origin writes and payload limits. Service credentials are used only in local-only test/demo scripts for fixture setup and exact fixture cleanup. No production data was reset, deployment triggered, or GitHub push performed.

Outbox events for sharing/sending contain identifiers only. There is no email or notification dispatcher yet: “sent” means visible in the customer's account, not emailed or messaged externally.

## Verification

- `npm run supabase:test`: 69 assertions across five suites (28 new sharing/offer assertions).
- `npm run test:offers`: 32 end-to-end HTTP/RLS/storage/Studio/customer checks, including opt-in/out, spoofed origin, other-user denial, hidden drafts and internal notes, exact totals, immutable sends, idempotence, decline and revocation.
- Existing 24 request checks, seven marketplace regressions and auth/catalog suites retained.
- CI now builds/serves Marketplace and Studio against its fresh local Supabase instance and runs the new offer suite. Remote CI has not run until these files are committed and pushed.
- Browser visual checks use the existing signed-in account; populated customer/owner demo checks require signing into the demo accounts. HTTP tests verify both roles independently without changing the user's browser session.
- Formatting, lint, TypeScript and all three production builds passed. The offer, request and marketplace HTTP suites also passed against production builds. The existing phone-account session was left unchanged; browser review covered mobile customer empty state and the desktop Studio access boundary, not populated owner screens.
- Follow-up migration `202608300006_offer_title_guard.sql` enforces nonblank quote titles even for direct RPC calls and indexes customer offer retrieval.

## Local review

Customer: `http://localhost:3000/offers` and `http://localhost:3000/requests`.

Studio: `http://localhost:3001/requests` and `http://localhost:3001/offers`.

For fictional populated examples, sign in as `customer@faden.local` with `FadenCustomer!2026`. Demo boutique owners are `demo-atelier-one@faden.local` and `demo-atelier-two@faden.local`, both with `FadenDemo!2026`. These are local fixtures only. Browser cookies are shared across localhost ports, so changing accounts changes the local session across the apps; use separate browser profiles for simultaneous role testing.

## Next phase and production gaps

Follow-up implemented: explicit offer acceptance → immutable order snapshot → unpaid checkout shell. See [order checkout review](order-checkout-review.md). Payment processing remains disabled. Resume with unpaid cancellation/amendment rules and verified Razorpay test integration before production journey.

Still required before production: granular staff roles, membership/ownership change policy, cancellation and amendment history, notification dispatch, request/offer pagination, abuse quotas and rate limits, stronger media validation, data retention/deletion tools and expired-draft cleanup. Revoked snapshots and private internal notes remain stored for now; retention policy is not yet implemented. Long-term account deletion with commerce references requires a dedicated workflow.
