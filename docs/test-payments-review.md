# Razorpay test payments & unpaid cancellation

## Implemented

Supabase remains the only database. Migration `202608300009_test_payments.sql` adds test-only payment attempts and audited unpaid cancellation without changing accepted quote snapshots.

- `/orders/[id]`: explicit, irreversible cancellation before checkout starts. Repeated cancellation is idempotent. A cancelled quote remains in history and cannot be reopened; changes require a new request. Full amendment/requotation workflows are not implemented.
- `/orders/secure?id=…`: Stitch checkout layout, test-mode notice and explicit advance consent; Razorpay Standard Checkout, failure/dismissal feedback, retry and manual status refresh.
- `/orders/[id]/receipt`: private **test payment receipt**, available only after verified capture. Clearly labelled not a tax invoice and not real money.
- Studio and customer lists/details show cancellation and test payment status distinctly. Test payments never start production, book fittings, collect the remaining balance or trigger shipments.
- `npm run env:local` now preserves Razorpay keys and other custom settings in each file while updating local Supabase connection values. It does not copy marketplace secrets into the other apps. Existing secret values were not changed or printed.

## Security & failure handling

Only `rzp_test_…` keys are accepted. Razorpay requests use a fixed HTTPS origin, reject redirects, have a timeout and redact provider error bodies. Provider requests contain saved advance amounts and an opaque attempt receipt, not measurements, addresses or customer notes. Key Secret and service-role credentials are server-only; only Key ID is sent to Checkout.

Authenticated same-origin payment routes first verify order ownership. Narrow service-only RPCs reserve and reconcile payment attempts. Customers cannot attach gateway IDs or mark captures through table writes or direct RPC calls. Payment attempt rows are customer-private; Studio sees only the commercial order status.

Checkout creation and cancellation serialize on the same order row. One attempt per order means parallel clicks and retries cannot silently create a second provider order. A timeout or failure after reservation leaves the attempt unresolved; it is **not automatically recreated**. Support must reconcile the existing receipt/provider order. Do not delete the reservation and retry without checking Razorpay. Even a known failure currently requires this conservative manual recovery.

Self-service cancellation is intentionally blocked once a payment attempt exists, including failed/dismissed/ambiguous attempts. Razorpay order creation and Supabase cannot share one transaction; cancelling locally while an existing provider checkout might complete would be unsafe. This limitation is disclosed before opening Checkout. Post-checkout cancellation/refunds need a separate workflow before launch.

Checkout signatures bind the stored provider order ID and returned payment ID. The server then fetches Razorpay payment data and requires matching order, amount, INR currency, `captured` status, `captured: true`, and no refund. Authorization alone never issues a receipt. Configure test auto-capture in the merchant dashboard; this version does not manually capture payments.

Webhook signatures use the untouched bounded raw body and the separate webhook secret, with constant-time comparison. Signed supported events are reconciled against a fresh provider fetch. Duplicate callbacks/webhooks are idempotent at the database payment/order boundary and emit one identifier-only outbox event. Irrelevant events cannot downgrade capture state. Unknown signed merchant events are acknowledged without importing other integrations' data. Database/provider errors return retryable status; no webhook payload containing payment PII is stored.

## Verified this phase

- Test API keys authenticated using a read-only Razorpay request; no secrets/account records were displayed.
- Actual app endpoint created one unpaid Razorpay sandbox order and reused it on retry with the saved amount, ignoring a spoofed browser total. No payment was authorized or captured. The isolated local fixtures were removed; that unpaid **test** order remains in the Razorpay dashboard.
- `npm run test:payments`: seven offline test groups cover signatures, raw-body integrity, malformed/unsigned webhooks, retry responses, exact capture qualification, API adapter behavior and environment preservation.
- `npm run supabase:test`: 118 assertions across seven suites (37 new payment/cancellation assertions).
- `npm run test:orders`: 62 HTTP/database checks, including cancellation-versus-checkout races, parallel reservation/capture, private receipts and test-only Studio labels. Optional `--gateway-smoke` adds two actual Razorpay order checks and must not run routinely in CI.
- CI runs offline payment tests and the expanded order suite. No real Razorpay credentials are required by CI, and it never simulates captures against real provider records. Direct capture RPC tests use isolated fake provider IDs solely to test database behavior.
- Formatting, lint, TypeScript and all three production builds passed. A read-only scan of 55 generated browser assets found no Razorpay Key Secret or encoded authorization value. Local Node 20 still emits a deprecation warning; Node 22 remains the project/CI target.
- Browser review preserved the existing login and checked the mobile order empty state without overflow. The current account has no accepted orders; populated checkout/receipt visual sign-off is still pending rather than claimed from fixture HTTP tests.

**Still unverified externally:** a completed Checkout test transaction, actual captured-payment callback, and end-to-end webhook delivery. Browser account switching/card entry was not performed. Do not interpret database fixture captures as real gateway capture verification.

## Required webhook setup

The Key ID and Key Secret are already in `apps/marketplace/.env.local`. The separate webhook secret is not configured yet.

1. Use a deployed **test** environment or an explicitly approved, controlled HTTPS ingress for the webhook endpoint. A Razorpay server cannot reach your `localhost`. No public tunnel or deployment was created in this phase.
2. In Razorpay **Test Mode**, configure a webhook targeting `https://YOUR-TEST-HOST/api/payments/webhook` and subscribe to `payment.captured`, `payment.authorized` and `order.paid`.
3. Choose a separate strong webhook secret there; add the same value as `RAZORPAY_WEBHOOK_SECRET` in the marketplace's private `.env.local` (or test hosting secrets). This is **not** the API Key Secret. Restart the app after changing environment values. Never paste secrets into chat or commit them.
4. Complete a test checkout using Razorpay's official test instruments, verify the test receipt, then exercise failed payment, abandoned checkout, authorization without capture, duplicate delivery and delayed callback recovery. Check dashboard delivery logs; only then mark external verification complete.

Without a webhook secret, the endpoint returns 503 and the checkout explains that automatic updates are pending. Signed browser callback verification and manual **Refresh payment status** can still reconcile a known attempt. No scheduled reconciliation worker exists yet.

References: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [Orders API](https://razorpay.com/docs/api/orders/create/).

## Next / production gates

Complete external sandbox verification and populated desktop/mobile visual review. Local demo offers belong to `customer@faden.local`; see the offer-phase review for fixture login details. The user's current account/session is unchanged.

Before live payments: resolve after-checkout cancellation/refunds and amendment history; add idempotent automated reconciliation/recovery, rate limiting/abuse quotas, webhook-secret rotation handling, refund/dispute/settlement tracking, monitoring and alerts, meaningful error/status codes, pagination/retention policies, tax invoices and notification dispatch. This phase has no refund-state synchronization; do not use it for live money. Live payments remain hard-disabled even if a live key is entered. No production deployment, GitHub push or merchant setting changes were made.

After payment readiness: design approval, production journey, fitting coordination, verified delivery addresses, courier integration and completion screens.
