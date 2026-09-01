# Production coordination checkpoint

## Scope and safety boundary

This is a **rehearsal-only** workflow while live payments and fulfilment remain disabled. Every stored update is constrained to `mode = rehearsal`; its UI and outbox event are explicitly labelled accordingly. It does not authorize manufacturing, change commercial order/payment status, collect money, send notifications, book a fitting or create a shipment. The Studio mutation endpoint is disabled when `NEXT_PUBLIC_APP_ENV=production`; direct database RPCs still only create labelled rehearsal records, never live production states.

Supabase remains the only database. Additive migration `202608310012_production_rehearsal.sql` creates private progress history, a security-invoker summary view, private progress photo storage and a narrow update RPC. No reset or account import is needed.

## Implemented

- Studio `/production`: authorized order board, mobile cards, search, milestone filters and desktop board/list switch. Pagination is 30 orders per page; search and stage counts apply to the loaded page, not the entire database. Cancelled orders leave the active board but retain accessible history through their order details.
- Studio `/orders/[id]/production`: record a timestamped note and optional private JPEG/PNG/WebP photo (8 MB maximum), after the customer's latest design is approved.
- Stages: fabric sourced → cutting → stitching → quality check → ready for fitting. Start at the first stage, then update the same stage or advance one step. No skipping or backwards transitions. **Ready for fitting is not an appointment booking.**
- Each order has up to 100 immutable updates. Corrections can be added as a same-stage note; replacing history or reversing milestones needs a future audited correction workflow.
- Customer `/journey/[id]`: the owned order's rehearsal milestones, progress notes and private photos alongside design history. No progress appears without a recorded update.
- Public local/staging `/preview/production` and `/preview/journey`: clearly fictional examples using original Stitch imagery. Only the gown sample has a linked journey; other cards are explicitly display-only examples. These routes are disabled in production mode.

## Permissions and failure handling

Only the original order owner who still owns its verified published boutique may publish. Other customers, new boutique owners and former owners cannot read prior progress; the order's customer can read their published history and photos. Summary-view reads inherit table RLS. Direct authenticated insert/update/delete access to history is denied.

The RPC locks the commercial order and validates ownership, design approval, cancellation, stage, expected sequence, confirmation and photo ownership. Stable command IDs make identical retries idempotent. Competing new updates have one winner; stale forms must reload. Reusing a command ID with different data is rejected. Audit/outbox payloads contain identifiers, not notes, photos or measurements.

Photos cannot be overwritten/deleted through user storage policies. Unpublished photos are visible only to their permitted owner. Published customer links expire after five minutes; refresh the page for new links. Already issued links remain valid until expiry. Failed/abandoned uploads may remain orphaned; cleanup, abuse quotas and stronger content validation remain production-readiness work.

## Design and verification

Stitch references: production board `d5e7c589`, mobile cards `29aac4f9`, customer journey `f6ce212b` / `daf8cc55`. Staff filters/assignment, drag-and-drop, due-risk claims and payment badges from the mockup are not invented: staff scheduling and reliable SLA data are not implemented. Empty columns are hidden to keep active orders visible. Full pixel parity and owner sign-off remain pending.

- `npm run test:designs` now also runs `scripts/test-production-workflow.mjs` inside the existing isolated local fixture: 43 production checks plus 45 design checks. The production helper uses explicit service-only fixture setup to vary design approval; this is not a replacement for customer approval in the application. Test rows and files are cleaned up, not retained as client data.
- `npm run supabase:test`: 151 assertions across ten suites.
- Production tests cover private images, role boundaries, summary RLS, immutable history, approval gate, repeated/concurrent submissions, invalid transitions, cancellation and unchanged commercial orders. They run in the existing GitHub design integration job; no remote CI run is implied.
- Browser review uses fictional pages, preserving the user's signed-in account. Authenticated editor/history routes are covered over HTTP; populated signed-in browser acceptance is still pending.
- Desktop 1280px and mobile 390px checks passed with no page overflow. Search, milestone filtering, the zero-results state and board/list controls were exercised; original Stitch progress photos loaded. All three local production builds, formatting, lint, TypeScript and 62 order/payment regression checks passed. Local development apps were automatically restarted and all health endpoints returned 200. Local Node 20 emits a known deprecation warning; hosting and CI use Node 22.

## Next checkpoint

The first appointment-booking slice is implemented; see [appointment checkpoint](appointments-phase.md) for its current limits and remaining integrations.

Measurement and fitting appointments: video-guided sessions and in-person boutique bookings, optional supported home visits, availability, timezone-safe conflict prevention, confirmation/reschedule/cancel, consent-based measurement updates and reminders. Choose the video provider before enabling meeting creation. Live production requires explicit release rules for payment clearance, customer consent and operational handoff; rehearsal records must never be promoted into evidence of completed work.
