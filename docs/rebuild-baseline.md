# FADEN rebuild baseline

This inventory freezes what existed before the Stitch parity rebuild. It protects working backend and infrastructure work while the visible product is corrected.

## Existing applications

- Customer marketplace: Next.js application on local port `3000`.
- Boutique Studio: Next.js application on local port `3001`.
- FADEN Admin: Next.js application on local port `3002`.
- Shared UI, configuration, authentication helpers, and Supabase clients are organized as workspace packages.

## Existing routes

### Marketplace

`/`, `/account`, `/auth/sign-in`, `/auth/callback`, `/boutiques/[slug]`, `/designs`, `/designs/[slug]`, `/discover`, `/saved`, and `/api/health`.

### Studio

`/`, `/auth/sign-in`, `/auth/callback`, `/onboarding`, `/portfolio`, and `/api/health`.

### Admin

`/`, `/auth/sign-in`, `/auth/callback`, `/auth/mfa`, `/auth/unauthorized`, and `/api/health`.

## Backend retained

- Supabase is the only application database and backend platform.
- Migration `202608290001_phase_one_foundation.sql`: foundation schema and row-level security.
- Migration `202608290002_auth_accounts.sql`: profiles, account roles, authentication support, and policies.
- Migration `202608290003_catalog_discovery.sql`: boutiques, designs, catalog discovery, seed-compatible data, and policies.
- Matching pgTAP suites exist for all three migrations.
- Authentication scaffolding exists across the three applications and remains the base for email/password, Google, Gmail-address login through Google, and phone OTP work.

## Infrastructure retained

- Docker development and web images in `docker/` plus `docker-compose.yml`.
- GitHub Actions CI in `.github/workflows/ci.yml` and preview workflow in `.github/workflows/preview.yml`.
- Workspace lint, formatting, type-checking, build, and test commands.
- Per-application health endpoints.

## Rebuild rule

Database migrations, RLS, authentication boundaries, CI/CD, Docker, health checks, and working data access are preserved unless a later feature specifically requires an additive change. Existing visual components and route layouts may be replaced whenever they conflict with Stitch. All 46 Stitch items are tracked in `docs/stitch-parity-map.md`, and the original exports remain immutable under `design-reference/stitch/`.
