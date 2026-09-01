# FADEN Platform

The step-by-step remaining implementation specification is in [docs/CURSOR_BUILD_PLAN.md](docs/CURSOR_BUILD_PLAN.md). It is organized as small Cursor-ready tickets with required files, database/security rules, acceptance criteria and validation commands.

FADEN is an India-first luxury custom-fashion marketplace. This repository contains three responsive web applications backed by one Supabase project:

- Marketplace (`http://localhost:3000`)
- Boutique Studio (`http://localhost:3001`)
- Platform Admin (`http://localhost:3002`)

## Current checkpoint

Boutique Studio now has Stitch-aligned overview and portfolio screens. The overview uses accessible Supabase counts, consented requests and IST session scheduling; the portfolio supports boutique selection, server-side search/category/status filters, pagination, creation/editing, explicit publishing and archival. Public fictional samples: Studio `/preview/overview` and `/preview/portfolio`. See [Studio checkpoint](docs/studio-overview-portfolio-phase.md). Collections and image uploads remain deferred.

Private order messaging is now implemented for the customer and original verified boutique owner, with unread counts, explicit read marking, text-only history and older-message navigation. Completion and order screens link to the conversation. `/preview/messages` is a fictional read-only sample. Refresh checks for replies; email/SMS, attachments and realtime delivery are not connected. See [messaging checkpoint](docs/messaging-phase.md).

Private aftercare rehearsal now follows delivery: one preview review per order, alteration requests, boutique responses and customer closure with retained history. Completion actions link to aftercare; `/preview/aftercare` is the public fictional example. Public ratings and real alteration work remain disabled. See [aftercare checkpoint](docs/aftercare-phase.md).

Delivery rehearsal is now implemented: private customer-confirmed (unverified) addresses, guarded shipment milestones, customer rehearsal confirmation and the Stitch completion screen. Public examples: `/preview/delivery` and `/preview/complete`. No real courier booking or delivery occurs. See [fulfilment checkpoint](docs/fulfilment-phase.md).

Measurement reservations are now available for accepted orders: video or boutique sessions, conflict-safe availability, booking/rescheduling/cancellation, owner-recorded completion/no-show outcomes and linked follow-up bookings. Studio has pending, upcoming and paginated history views. These remain preview-only; calls and reminders are not connected. See [appointment checkpoint](docs/appointments-phase.md) and `/preview/appointments`.

The repository includes authentication, catalog/discovery, private outfit requests, consented boutique sharing, offers, accepted orders, test-only checkout, private versioned design reviews, and a rehearsal production board with private progress notes/photos. Live production and fitting bookings are not enabled yet. See the [production checkpoint](docs/production-phase.md) and try `/preview/production` locally or in staging.

See [the design-review checkpoint and next phases](docs/design-review-phase.md), [Stitch parity map](docs/stitch-parity-map.md), and [preview hosting notes](docs/vercel-staging.md). Public fictional previews are at `/preview/design-approval` and `/preview/journey` in local/staging environments. Live payments and hosted identity-provider setup are deferred.

## Requirements

- Node.js 22+
- npm 10+
- Docker Desktop

## Start the complete local environment

```bash
npm install
npm run supabase:start
npm run env:local
npm run seed:auth
npm run dev
```

`supabase:start` applies migrations on a fresh local stack. For an existing local stack, apply pending migrations with `npx supabase migration up --local` first. Do not reset an existing database to resume development: resetting erases local data. Demo users are local-only; never seed them into staging or production.

Or start one application:

```bash
npm run dev:marketplace
npm run dev:studio
npm run dev:admin
```

The environment remains available at:

- Marketplace: `http://localhost:3000`
- Boutique Studio: `http://localhost:3001`
- Platform Admin: `http://localhost:3002`
- Supabase Studio: `http://127.0.0.1:54323`
- Local email inbox: `http://127.0.0.1:54324`

## Local authentication

Phone OTP uses the local-only number `+919999999999` and code `123456`. Demo email accounts are seeded for each role; their credentials are displayed only on local sign-in screens. Admin access requires enrollment in an authenticator app after password sign-in.

Google sign-in and identity linking are implemented but deliberately disabled locally until OAuth credentials are added to Supabase and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` is set. Never commit provider secrets.

`npm run env:local` securely reads the local CLI status and writes ignored `.env.local` files for all apps without printing credentials.

## Quality checks

```bash
npm run check
npm run supabase:test
npm run test:auth
npm run test:catalog
```

See [Phase 3 documentation](docs/phase-3.md) for the catalog schema, discovery routes, Studio workflow, and security boundaries.
