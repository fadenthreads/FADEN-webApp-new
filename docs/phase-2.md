# Phase 2 — Authentication and accounts

## Delivered

### Shared authentication

- Supabase SSR sessions stored in secure cookies and refreshed by middleware
- Email and password registration and sign-in
- Phone OTP sign-in with a deterministic local-only test identity
- Google OAuth sign-in and manual identity-linking integration points
- Safe OAuth callback redirects that reject external redirect targets
- Sign-out flows in Marketplace, Studio, and Admin
- Local demo accounts for customer, boutique owner, and administrator roles

### Customer account

- Protected account route
- Editable display name and contact phone
- Default Indian delivery address with room for future map coordinates
- Transactional, marketing, SMS, and WhatsApp communication preferences
- Connected identity visibility
- Google identity linking when OAuth is enabled
- Verified phone-number change flow

### Boutique Studio

- Protected Studio routes
- Boutique application with name, handle, city, and description
- Atomic onboarding database function that creates the boutique, assigns ownership, records an audit event, and queues an outbox event
- Guard against duplicate boutiques and privileged roles using the onboarding function
- Review-state Studio dashboard for boutique owners

### Administration

- Admin-only routing based on the verified Supabase user and database role
- Mandatory authenticator-app TOTP enrollment and AAL2 verification
- Non-admin denial screen
- Audited AAL2-only database function for future administrative role changes

## Database and security

- `user_addresses`, `user_preferences`, and `boutique_invitations` tables
- RLS on all new account tables
- Column-level profile grants prevent customers from changing their own role
- Sensitive audit and outbox tables remain unavailable to browser clients
- Admin-sensitive database access checks both the admin role and AAL2 claim
- Generated TypeScript database types are committed and refreshed with `npm run supabase:types`
- 15 pgTAP assertions cover the foundation and Phase 2 security objects
- Auth smoke test verifies email login, fixed local phone OTP, and blocked direct role escalation

## Production configuration still required

Code and configuration boundaries are ready, but these provider-owned credentials must be supplied outside the repository:

- Hosted Supabase project URL and publishable/server keys
- Google OAuth client ID and secret, with callback URLs for each environment
- Production SMS provider; for India, complete the relevant sender/template registration before live SMS delivery
- Transactional SMTP provider and branded auth email templates
- Hosting provider environment variables and deployment credentials

The fixed phone number, fixed OTP, local Twilio placeholders, seeded accounts, and demo credentials are development-only and must not be copied into hosted Supabase settings.

## Local verification

```bash
npm run supabase:test
npm run test:auth
npm run check
npm run format:check
npm audit --omit=dev
```

CI runs Node 22, the same runtime used by Docker builds. The current host may print a Node 20 deprecation warning, but the repository explicitly requires Node 22 or later.
