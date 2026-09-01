# Custom-outfit request journey — review checkpoint

## Implemented

- Six steps: occasion and garment, inspiration, style, measurements, budget/date, and review/confirmation.
- The five supplied Stitch desktop screens inform the hierarchy, typography, source photographs, layouts and controls. Dedicated mobile references inform the inspiration, measurements and budget layouts. No generated replacement photography.
- Source exports have inconsistent step numbering. The app uses a consistent six-step sequence, including the added final review, without displaying a fake order-completion screen.
- Homepage, design details and boutique profiles enter `/create`; the latter two retain the chosen design/boutique on the request. Header Atelier and account actions expose `/requests`.
- Signed-in customers can save and resume private drafts. Each save is version checked; conflicting tabs cannot silently overwrite a newer version.
- Private inspiration uploads accept JPG/PNG/WebP, at most 10 MB each and eight images per request. The server checks basic file signatures; Supabase enforces a private bucket and owner/request-path policies. Previews use 15-minute signed URLs.
- Reference links accept HTTPS without embedded credentials. The server does not fetch URLs or embed third-party content.
- Style includes expert curation, up to three colors, silhouette, neckline, sleeves and fabric preferences.
- Measurements support manual entry, a private reusable profile, centimetre/inch conversion, assisted fitting preferences, or deciding later. Fitting options do not book appointments or imply confirmed availability.
- Budget and date preferences include date ordering checks and a short-lead-time notice. Budget is not a confirmed quote.
- Submission requires reviewed details and explicit confirmation, locks the brief, and emits one minimal outbox event. Repeated submissions return the same request, not duplicate events.
- Owner-only dashboard and submitted-request summary. Customers cannot read or modify another customer's requests or measurement profiles. Boutique accounts cannot access customer briefs yet.

## Data and security

Additive local migration `202608300004_outfit_requests.sql` creates `outfit_requests`, `measurement_profiles`, private inspiration storage policies, the submission RPC and version trigger. Existing data was not reset. Supabase remains the only database.

Mutations require an authenticated Supabase user and a same-origin request. Server code validates shape, enums, sizes, dates, measurements and ownership; database policies and the submission function independently enforce ownership, status transitions and minimum required submission data. No service-role key is used by the application request endpoints.

`npm run test:requests` runs 24 HTTP/auth/storage checks against **local Supabase and the running marketplace only**. It removes only its own temporary request, upload and outbox event. `npm run supabase:test` contains 41 database assertions across four files, including 16 request/profile privacy and submission assertions.

CI's database job now builds and serves the marketplace against its fresh Supabase instance, then runs marketplace and request integration tests. Raw Stitch HTML exports and CLI-generated database types are excluded from Prettier to preserve their source format; application code remains checked.

Browser checks covered required occasion/garment validation, saved step navigation, mobile inspiration/style/measurement/budget layouts, Save & Exit, and the private dashboard. A Wedding/Lehenga demo remains as an unsubmitted draft for local review; no personal measurements were entered. Final production builds and existing auth/catalog regressions are also part of the checkpoint.

## Boundaries and remaining work

- This phase saves customer briefs. It does not send them to boutiques, charge money, book fittings or couriers, create offers, or send email. The outbox event is a future integration boundary, not evidence that a notification was sent.
- Boutique matching/assignment must enforce explicit sharing rules before exposing briefs, measurements or images. Add Studio request handling and offers next, then customer comparison and ordering/payment.
- Removing an image from the board removes the draft reference on the next save; the private original currently remains in storage. Add authenticated deletion and a retention/orphan-cleanup policy before production. Signed previews may need a page refresh after expiry.
- The 20-draft API cap is a usability guard, not comprehensive abuse prevention. Production still needs rate limiting, storage quotas, image decoding/re-encoding/scanning, retention/deletion tools, monitoring, and a full security review. Direct authenticated Supabase access can bypass API-only format checks but not RLS ownership or RPC status rules.
- Request submission is immutable in this phase; cancellation, deletion, revisions and amendment history need explicit lifecycle policies in later phases.
- Final owner visual approval is pending. No claim of pixel-perfect parity across every screen or viewport.
- The project targets Node 22+. This machine currently runs Node 20; local HTTP fixtures use a disabled Realtime transport because they do not open websocket connections.

## Resume point

Consent-controlled request sharing, Studio proposals and customer offer comparison are now implemented; see [offers-phase-review.md](offers-phase-review.md). Next is offer acceptance and secure checkout. Preserve the private drafts and additive migration history. Earlier boundaries above describe the request-wizard checkpoint; the linked offer checkpoint supersedes its sharing/offer deferrals.
