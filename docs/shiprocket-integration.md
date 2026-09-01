# Shiprocket integration foundation

The provider boundary is prepared but deliberately disconnected. No API credentials are required during development, no courier request is sent, and no real shipment can be booked.

## Safety gates

- `SHIPROCKET_API_ENABLED` defaults to false. Authentication, serviceability, tracking and webhook processing must not call Shiprocket until it is explicitly true.
- `SHIPROCKET_LIVE_BOOKING_ENABLED` defaults to false. Booking additionally requires every credential and `NEXT_PUBLIC_APP_ENV=production`.
- Credentials belong only in the Studio server environment. They must never use a `NEXT_PUBLIC_` prefix, be committed, logged or returned by readiness endpoints.
- The webhook rejects missing/incorrect tokens, caps payloads at 256 KiB and currently returns 503 after validation so an event is never acknowledged before persistence is connected.
- Provider calls have a ten-second timeout and return generic errors. API authentication tokens are cached only in server memory.
- `shipping_commands` supplies durable idempotency/reconciliation records for order creation, AWB assignment, pickup, cancellation, tracking, label and manifest operations.

## Prepared capabilities

- API authentication
- PIN-code serviceability and courier discovery
- prepaid/COD parameter support
- order creation
- AWB assignment
- pickup scheduling
- AWB tracking
- label and manifest generation
- provider status normalization, including failures and RTO
- private shipment/tracking storage protected by Supabase RLS
- authenticated, secret-free readiness endpoint at `/api/shipping/readiness`

## Environment contract (Studio only)

```env
SHIPROCKET_API_EMAIL=
SHIPROCKET_API_PASSWORD=
SHIPROCKET_PICKUP_LOCATION=
SHIPROCKET_PICKUP_POSTCODE=
SHIPROCKET_WEBHOOK_SECRET=
SHIPROCKET_API_ENABLED=false
SHIPROCKET_LIVE_BOOKING_ENABLED=false
```

When the provider is connected later, implement the final persistence transaction and reconciliation worker before changing either flag. Live booking also remains blocked until payment clearance, package dimensions/weight, operational approval and pickup ownership are defined.
