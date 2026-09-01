# Client preview on Vercel

This is a staging deployment, not a live-commerce launch. Supabase is the only database.

## Deployed preview — 1 September 2026

- Marketplace: https://faden-preview-marketplace.vercel.app
- Studio: https://faden-preview-studio.vercel.app
- Admin: https://faden-preview-admin.vercel.app

All three are deployed in Faden Team on the existing Hobby plan at the user's request. No billing settings were changed. They are isolated from the old `faden-web-app-web` and `faden-web-app-admin` projects. Vercel calls the stable alias deployment target `production`; these apps nevertheless use `NEXT_PUBLIC_APP_ENV=staging` and the separate staging database, not live commerce.

Current deployment IDs: Marketplace `dpl_7XpjnSkTwTmTLSAtp5Q1e3qnx85Q` (unchanged), Studio `dpl_9zMLZQCcmTw4tiMFhoJiFwYCB1eX` (overview/portfolio update), Admin `dpl_BnbrGa69JFtayhMX6e1CGfAw8Ztn` (unchanged).

The Studio overview/portfolio checkpoint follows the exported Stitch desktop layouts and mobile adaptation. Real overview counts and sessions replace unsupported fictional financial metrics. Catalog members can search/filter/page, create/edit and explicitly publish/archive designs. Public fictional samples are `/preview/overview` and `/preview/portfolio` on the Studio host. No database migration, permission widening, fixture import or provider setup was needed. Supabase remains the only database. See [Studio checkpoint](studio-overview-portfolio-phase.md).

The messaging checkpoint adds private text-only customer/boutique order conversations, unread counts, explicit read marking, immutable message history and older-message navigation. Order details and completion link to messaging; `/preview/messages` is the public fictional sample. Migration 017 is applied, and a follow-up dry run confirms no pending migrations. No fixtures/accounts were imported, and no external email/SMS, attachment or realtime providers are connected. See [messaging notes](messaging-phase.md).

Messaging rollout verified: Marketplace and Studio reached Ready, with healthy stable aliases. The public messaging/completion previews return 200, retain noindex and link correctly; the hosted messaging sample has no horizontal overflow. Both private conversation routes redirect anonymous visitors to sign-in (307), and both APIs reject anonymous sends (401). Authenticated send/read flows were tested locally; hosted authenticated acceptance testing remains pending. The existing CI command now includes messaging checks, but no GitHub commit/push or remote CI run was performed.

The aftercare checkpoint adds private preview reviews, alteration requests, boutique responses and customer closure with retained history. Completion actions link to `/orders/[id]/aftercare`; the public fictional example is `/preview/aftercare`. Migration 016 was applied without resets, fixtures or account imports. Feedback never changes public ratings, and no real alterations, fees, pickups, invoices or messages are created. See [aftercare notes](aftercare-phase.md).

Aftercare rollout verified: both updated deployments reached Ready and both health endpoints return 200. Public aftercare/completion previews return 200, retain noindex and contain no localhost links. The hosted sample renders without horizontal overflow. Customer and Studio private aftercare routes redirect anonymous visitors to sign-in (307); both aftercare APIs reject anonymous POSTs (401). Hosted authenticated submission/response remains untested; all full-workflow checks use local fixtures only.

The fulfilment checkpoint adds private customer-confirmed/unverified addresses, owner-recorded shipment rehearsal milestones, customer rehearsal confirmation and the gated Stitch completion screen. Public fictional samples are `/preview/delivery` and `/preview/complete`. Migration 015 was applied additively without resets, fixtures or account imports. No maps, courier, labels, real shipments or delivery notifications are connected. See [fulfilment phase notes](fulfilment-phase.md).

Fulfilment rollout verified: both updated deployments reached Ready and both health endpoints return 200. Both public sample routes and the original Stitch image return 200; pages retain noindex and contain no localhost navigation. Customer delivery/completion and Studio delivery routes redirect anonymous requests to sign-in (307). Both fulfilment APIs reject anonymous POSTs (401). The hosted completion page renders its original 1408-pixel-wide image without horizontal overflow. Hosted authenticated fulfilment remains untested; no live shipment was created.

The outcome checkpoint adds owner-recorded completion/no-show status after the session end, private outcome history, linked customer-confirmed follow-ups, and paginated Studio booking views. Migration 014 was applied to staging without reset or fixture import. The public appointment example now shows fictional completed/no-show sessions and a disabled follow-up action. Outcomes do not update measurements, payment or send notifications.

Outcome rollout verified: both updated deployments reached Ready, and both health endpoints return 200. Marketplace `/preview/appointments` renders the new history/follow-up example with noindex, no localhost links and no horizontal overflow. Private customer appointments and Studio pending/history views redirect anonymous visitors to sign-in (307). Anonymous outcome submissions return 401 in both apps. Hosted authenticated outcome recording remains untested; the full workflow checks use local fixtures only.

The appointment checkpoint adds public `/preview/appointments`, authenticated customer `/orders/[id]/appointments`, Studio `/appointments`, and preview-only reservation APIs. The public example is fictional with disabled booking controls; video calls, reminders and home visits are not connected. Migration 013 was applied additively without seeds or account imports. See [appointment phase notes](appointments-phase.md).

Both appointment deployments reached Ready. Verified after rollout: updated health endpoints return 200, the public sample returns 200 with noindex and no localhost navigation, customer/Studio appointment pages redirect anonymous users to sign-in, and both appointment APIs return 401 for anonymous same-origin POSTs. The hosted sample renders without horizontal overflow. Authenticated hosted booking still needs end-to-end acceptance after provider configuration; no live appointment was created by these checks.

The earlier production checkpoint added `/preview/production` and updated `/preview/journey` with clearly labelled rehearsal progress. Both return HTTP 200, retain noindex and contain no localhost navigation. Studio `/production` redirects anonymous visitors to sign-in. Migration 012 was applied additively; no fixture records, local accounts or secrets were imported. See [production phase notes](production-phase.md). GitHub CI includes the new tests, but these deployments are still CLI uploads rather than Git-triggered deployments.

New public, fictional review screens: Marketplace `/preview/design-approval` and `/preview/journey`. These are read-only examples, not real client orders. The actual approval, journey and Studio design editor remain authenticated. Hosted sample pages and the sketch return HTTP 200; private order routes redirect anonymous visitors to sign-in. Preview pages retain noindex and have no localhost navigation.

Verified: all builds Ready; all health endpoints HTTP 200; Marketplace home/images/discovery render; no localhost links on the homepage; Studio/Admin redirect anonymous users to sign-in; anonymous catalog reads succeed and private profile/order reads are denied. Preview pages use noindex/nofollow. Production dependency audit reports no vulnerabilities. No completed hosted sign-in, order, payment, or MFA journey has been tested.

Migrations 001–016 have been applied to `jhjxhcgwdiskyojywlxo`, including private design reviews, rehearsal progress, private storage buckets, appointment reservations/outcomes, fulfilment and aftercare rehearsal. No database reset, seeds or local account import was performed. No local accounts, demo credentials, private requests, or sample catalog were imported; the initial catalog was empty. Only the staging publishable key is configured in Vercel. No Supabase server secret or Razorpay credentials are configured there. The payment webhook returns configuration-unavailable status.

Authentication: the earlier automated Site URL/allowlist change was not performed because Keychain access was denied. The user subsequently reported saving the dashboard configuration; hosted sign-in and callback behavior have not been independently verified. Keep the Site URL set to Marketplace and allow each app's `/auth/callback`, preserving needed local redirects. Google and phone providers remain unconfigured for hosted use, and email delivery/confirmation links still need testing. Provider setup is deferred at the user's request. The local phone OTP and demo passwords do not apply to these hosted sites.

These initial deployments were uploaded through the CLI. No GitHub commit/push or Git-triggered deployment connection has been made. Use an explicit `--project faden-preview-marketplace`, `--project faden-preview-studio`, or `--project faden-preview-admin` plus `--scope faden-team` when deploying from the repository root; do not overwrite the old projects. Stable URLs stay the same when updates are deployed.

## Projects

Connect `fadenthreads/FADEN-webApp-new` to three Vercel projects. Use the Next.js preset, Node.js 22, and include source files outside each Root Directory so shared workspace packages are available. Install dependencies from the repository root using the lockfile; build with `npm run build` in the selected app. Keep the default Next.js output setting (do not use a static export).

| Project         | Root Directory     |
| --------------- | ------------------ |
| Marketplace     | `apps/marketplace` |
| Boutique Studio | `apps/studio`      |
| Admin           | `apps/admin`       |

Use a plan suitable for commercial/client work. Do not purchase or upgrade without approval. Keep client previews access-controlled using the team's supported protection/sharing settings. Admin additionally retains its application role and MFA checks. Do not disable those checks to make a preview easier to access.

## Environment

Set these separately in each project's Vercel environment settings, for every deployment environment used for staging:

- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_SUPABASE_URL=https://jhjxhcgwdiskyojywlxo.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the staging project's public key.
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` until the Google provider is configured and tested.
- `NEXT_PUBLIC_MARKETPLACE_URL`: the actual stable HTTPS Marketplace URL.
- `NEXT_PUBLIC_STUDIO_URL`: the actual stable HTTPS Studio URL.
- `NEXT_PUBLIC_ADMIN_URL`: the actual stable HTTPS Admin URL.

Where a server route requires `SUPABASE_SECRET_KEY`, configure the staging secret only as a server-side environment variable, never with a `NEXT_PUBLIC_` prefix. Do not copy local Supabase keys or the localhost `DATABASE_URL`. Leave all Razorpay credentials unset for the initial preview; checkout must not be presented as ready for real payments. Redeploy after changing public environment variables.

## Database and authentication

Before client testing, apply the reviewed migrations to the linked staging project. Do not run a database reset. Do not upload local demo users, known local passwords, private requests, or local environment files. Review any sample catalog content separately before seeding staging.

Configure Supabase's Site URL for the stable Marketplace URL and allow the exact `/auth/callback` URL for each deployed application. Keep localhost redirects if local development still needs them. Configure hosted email delivery, Google, and SMS providers separately; local authentication test success does not prove hosted providers work.

## Release checks

- Confirm all three builds succeed against staging configuration.
- Open the deployed URLs and verify navigation never points to localhost.
- Verify catalog data, authentication redirects, session persistence, and private-data isolation.
- Verify Studio access restrictions and Admin role/MFA enforcement.
- Verify payment actions fail safely while payment configuration is absent.
- Confirm the client can use the intended preview access method.
- Connect Git-based deployment only after secret review and verify the first deployment. The existing GitHub preview-artifacts workflow alone does not publish a website.

Docker remains available for container-based hosting; Vercel uses its Next.js build rather than the repository's Dockerfiles.
