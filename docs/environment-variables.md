# FADEN environment variables

This document lists environment variables used across FADEN applications. Never commit real secrets. Set values in local ignored `.env.local` files and in Vercel project settings.

## Browser-safe variables

These may appear in client bundles. They must never be the only control for a privileged server action.

| Variable                               | Apps                       | Purpose                                                                                     |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Marketplace, Studio, Admin | Supabase project URL                                                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Marketplace, Studio, Admin | Supabase publishable/anon key                                                               |
| `NEXT_PUBLIC_APP_ENV`                  | All                        | Display and non-security routing labels (`development`, `preview`, `staging`, `production`) |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`      | All                        | Show Google sign-in UI only                                                                 |
| `NEXT_PUBLIC_PHONE_AUTH_ENABLED`       | All                        | Display flag for deferred phone OTP                                                         |
| `NEXT_PUBLIC_MARKETPLACE_URL`          | All                        | Canonical marketplace origin                                                                |
| `NEXT_PUBLIC_STUDIO_URL`               | All                        | Canonical studio origin                                                                     |
| `NEXT_PUBLIC_ADMIN_URL`                | All                        | Canonical admin origin                                                                      |

## Platform workflow flags (server-only)

| Variable                        | Default | Purpose                                                                                      |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `FADEN_ENABLE_LIVE_WORKFLOWS`   | `false` | Master server gate for live payments, shipping, Daily rooms and transactional email dispatch |
| `FADEN_ALLOW_PREVIEW_MUTATIONS` | `false` | Allows rehearsal/preview mutation routes in non-live environments. Do not set in production  |

Use `@faden/integrations` readiness helpers instead of reading these flags directly in routes.

## Supabase (server-only)

| Variable              | Apps                   | Purpose                                                               |
| --------------------- | ---------------------- | --------------------------------------------------------------------- |
| `SUPABASE_SECRET_KEY` | Scoped server routes   | Service-role access for verified webhooks and narrow admin operations |
| `DATABASE_URL`        | Scripts, local tooling | Direct Postgres access for migrations and tests                       |

## Payments — Razorpay (Marketplace server)

| Variable                    | Default     | Purpose                                                                        |
| --------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `RAZORPAY_KEY_ID`           | placeholder | Razorpay key ID. Test keys only until live activation                          |
| `RAZORPAY_KEY_SECRET`       | placeholder | Razorpay API secret                                                            |
| `RAZORPAY_WEBHOOK_SECRET`   | placeholder | Webhook signature secret                                                       |
| `RAZORPAY_PAYMENTS_ENABLED` | `false`     | Enables payment provider actions when credentials and live workflows are ready |

Readiness: `getPaymentsReadiness()` from `@faden/integrations`.

## Shipping — Shiprocket (Studio server)

| Variable                          | Default            | Purpose                        |
| --------------------------------- | ------------------ | ------------------------------ |
| `SHIPROCKET_API_EMAIL`            | placeholder        | API user email                 |
| `SHIPROCKET_API_PASSWORD`         | placeholder        | API user password              |
| `SHIPROCKET_PICKUP_LOCATION`      | placeholder        | Dashboard pickup location name |
| `SHIPROCKET_PICKUP_POSTCODE`      | placeholder        | Pickup PIN code                |
| `SHIPROCKET_WEBHOOK_SECRET`       | placeholder        | Webhook verification token     |
| `SHIPROCKET_API_BASE_URL`         | Shiprocket default | Optional API base override     |
| `SHIPROCKET_API_ENABLED`          | `false`            | Enables Shiprocket API usage   |
| `SHIPROCKET_LIVE_BOOKING_ENABLED` | `false`            | Allows live booking attempts   |

Readiness: `getShippingReadiness()` from `@faden/integrations`.

## Video — Daily (Marketplace + Studio server)

| Variable                   | Default       | Purpose                               |
| -------------------------- | ------------- | ------------------------------------- |
| `DAILY_API_KEY`            | placeholder   | Daily REST API key                    |
| `DAILY_API_BASE_URL`       | Daily default | Optional API base override            |
| `DAILY_API_ENABLED`        | `false`       | Enables Daily API usage               |
| `DAILY_LIVE_ROOMS_ENABLED` | `false`       | Allows private live room provisioning |

Readiness: `getDailyReadiness()` from `@faden/integrations`.

## Maps — Geoapify (Marketplace server)

| Variable           | Default     | Purpose                                |
| ------------------ | ----------- | -------------------------------------- |
| `GEOAPIFY_API_KEY` | placeholder | Server-side autocomplete/geocoding key |
| `MAPS_API_ENABLED` | `false`     | Enables address autocomplete route     |

Readiness: `getMapsReadiness()` from `@faden/integrations`.

## Email dispatch (worker/server)

| Variable                 | Default | Purpose                                          |
| ------------------------ | ------- | ------------------------------------------------ |
| `SMTP_HOST`              | unset   | Outbound SMTP host for transactional mail worker |
| `SMTP_USER`              | unset   | SMTP username                                    |
| `SMTP_PASSWORD`          | unset   | SMTP password                                    |
| `EMAIL_DISPATCH_ENABLED` | `false` | Enables outbound transactional email dispatch    |

Auth email is currently handled by Supabase Auth via Resend and is configured in Supabase project settings, not application env files.

Readiness: `getEmailReadiness()` from `@faden/integrations`.

## Readiness response shape

All integration readiness helpers return:

```ts
{
  provider: string;
  configured: boolean; // required credentials present
  enabled: boolean;    // explicit integration enable flag(s) are true
  live: boolean;       // configured + enabled + platform live gate where applicable
  missing: string[];   // credential names only; never values
}
```

Authenticated readiness API routes must expose only `toPublicReadiness()` output, which omits `missing`.

## Local development defaults

Copy `.env.example` to app-specific `.env.local` files. For rehearsal workflows locally, set:

```env
FADEN_ALLOW_PREVIEW_MUTATIONS=true
```

Keep `FADEN_ENABLE_LIVE_WORKFLOWS=false` until activation tickets explicitly authorize live provider actions.
