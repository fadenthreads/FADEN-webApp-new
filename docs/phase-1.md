# Phase 1 — Engineering foundation

## Delivered

- npm/Turborepo monorepo
- Marketplace, Studio, and Admin application shells
- Shared FADEN design tokens and UI package
- Responsive desktop/mobile navigation foundation
- Supabase-only database architecture
- Initial profile, boutique, membership, audit, and outbox schema
- RLS policies and pgTAP checks
- Environment validation package
- Local Supabase CLI workflow
- Docker development and production-image foundations
- CI quality, database, and container jobs
- Preview-build artifacts
- Application health endpoints

## Local ports

| Service         | URL                    |
| --------------- | ---------------------- |
| Marketplace     | http://localhost:3000  |
| Boutique Studio | http://localhost:3001  |
| Admin           | http://localhost:3002  |
| Supabase API    | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Inbucket        | http://127.0.0.1:54324 |

## Preview deployment

Pull requests produce verified Next.js build artifacts. Connecting a hosted preview requires credentials from the selected hosting provider; those credentials must be configured as repository secrets rather than committed.

## Monitoring foundation

Each app exposes `/api/health`. Phase 2 will connect structured authentication events; production error reporting is enabled when the chosen monitoring provider credentials are configured.

## Phase 2 entry criteria

- Local apps build and load
- Supabase migration resets successfully
- RLS tests pass
- CI configuration validates
- Staging Supabase and preview-hosting credentials can be added without code changes
