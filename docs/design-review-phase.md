# Design reviews and outfit journey

## Implemented

- Studio `/orders/[id]/design`: original verified boutique owner uploads a private JPEG, PNG or WebP sketch (up to 8 MB), adds design notes and fabric/detailing references, and publishes a version for the customer.
- Marketplace `/orders/[id]/approval`: view the latest sketch, approve it or request changes with feedback and explicit confirmation. Published design content cannot be overwritten. A new version is allowed after a change request, up to 20 versions per order.
- Version history preserves sketches, design notes, customer decisions and dates. Cancelled orders remain read-only. Approved designs cannot be reopened; commercial amendments are a future workflow.
- `/journey/[id]`: authenticated, read-only journey showing order acceptance and actual design-review history. Fabric sourcing, cutting, stitching, fitting and delivery are labelled **Not started**, not inferred from approval or a test payment.
- `/preview/design-approval` and `/preview/journey`: labelled fictional examples, available locally and in staging without accounts. Decision controls are disabled. These routes return 404 when `NEXT_PUBLIC_APP_ENV=production`.

Supabase remains the only database. Migration `202608310011_design_reviews.sql` adds the version table, private `order-designs` bucket, RLS, narrow publish/decision RPCs, audit events and identifier-only notification outbox events. No emails are sent yet. No payment, quote, production or delivery operation is triggered by a design decision.

## Privacy and consistency

Customers can access only their orders' published sketches. The original boutique owner must still own the verified boutique; transferring ownership does not transfer access to old orders. Sketch links expire after five minutes: refresh the page to obtain a fresh link. An already issued link remains usable until expiry; it is not instant revocation. Private sketches bypass public image optimization caches.

Clients have no direct insert/update/delete access to review records and cannot replace or delete uploaded sketches. RPCs lock the order, check ownership and the current revision, reject stale decisions and serialize competing decisions. Exact retries are idempotent. Routes require signed-in users and a matching request origin; no service-role key is used by these application endpoints.

## Stitch fidelity

Approval follows `414d2098`; the journey follows desktop `f6ce212b` and mobile `daf8cc55`. The fictional approval uses the existing original Stitch imagery, not generated substitutes. Real sketches are shown uncropped so the customer can inspect the entire design. Real fabric/detailing references are text until private swatch uploads are implemented.

Navigation, preview labels, explicit consent and version history are functional additions. The mockup's automatic change-fee claim is not shown because no such policy is implemented. The journey is a foundation, not the finished production progress/story layout. Owner visual sign-off and populated authenticated browser review remain pending; do not describe this checkpoint as exact pixel parity.

## Verification

- `npm run test:designs`: 45 local HTTP/database/storage checks covering authorization, private images, immutable versions, retries, competing decisions, cancelled orders and journey rendering. Fixtures are isolated and removed afterwards; no browser account is switched.
- `npm run supabase:test`: 143 assertions across nine suites.
- Existing order, offer, request, marketplace and offline payment regressions are included in the phase checks.
- Current run passed: 62 order/payment, 32 offer/sharing, 24 private-request, seven marketplace and seven offline payment checks. Formatting, lint, TypeScript and all three local production builds passed. The local runtime still warns about Node 20; the configured CI/hosting target is Node 22.
- The design suite is included in GitHub CI. Its presence in the workflow does not mean a remote CI run or Git-based deployment has happened.
- Desktop (1280 CSS pixels) and mobile (390 CSS pixels) fictional preview checks verify loaded images and no horizontal overflow. Actual owner/customer workflows are tested over HTTP rather than by changing the user's browser login.

Before launch: upload abuse/rate limits, abandoned-upload cleanup, malware/content validation beyond declared MIME types, retention/erasure policy, notification dispatch, monitoring, private swatch uploads and approved-design amendment handling still need work.

## Resume here

Production rehearsal is now implemented; see [the next checkpoint](production-phase.md) for current scope, tests and the fitting-booking phase that follows. The list below describes the broader release sequence.

1. Production coordination: Studio queue and order detail, authorized manual milestone updates, timestamped progress notes/photos, and the matching customer journey. Keep test/demo operations separate from real production authorization.
2. Measurement and fitting appointments: video-guided measurement sessions and in-person appointments at a boutique; optional home visits only where the boutique offers them. Implement availability, timezone handling, conflict-safe booking, confirmation, cancellation/rescheduling and no-show statuses. Add private meeting links for video, verified locations/addresses for in-person, reminders and consent-based measurement updates with history. Current measurement preferences do not reserve appointments. Select the meeting provider before implementation; do not enable recording by default.
3. Address confirmation, courier booking/tracking, delivery/completion and support/disputes, with provider credentials and operational policies supplied before enabling external actions.
4. Final integration/readiness gates: hosted Google OAuth, email delivery, phone OTP, notification workers, observability, abuse controls, backups/recovery, accessibility and end-to-end acceptance. Live payments stay last, including refunds/reconciliation and full sandbox verification first. No paid service or provider is enabled automatically.
