# FADEN flow testing — 27 October 2026

Scope: `APPLICATION_FLOW_TEST_PLAN.md`. This is an evidence report, not a declaration that all 42 flows passed.

Update: the user subsequently selected an isolated test environment. The connected registration → Admin approval → quotation → simulated payment → production → manual delivery → review journey now passes. See [the isolated journey report](ISOLATED_ORDER_JOURNEY_RESULTS.md) for 31 checks, 479 SQL/RLS tests, fixes and hosted-rollout limitations. The matrix below records the earlier live audit, not that later isolated result.

## Completed checks

- `node scripts/test-public-flow-smoke.mjs --live`: **36 anonymous production smoke checks passed**. Public customer pages, canonical `/designs` redirect, protected C/S/A redirects, safe callback-error returns and pending/approved boutique visibility. No account/order/provider mutations in this script.
- Arc: discovery design quick-view opened; its View design link reached the matching product; switching Designs → Materials → Boutiques worked. Map panel opened; choosing Hyderabad returned only two matching boutiques; clearing restored all four. Dynamic search for Vanya produced the matching suggestion and one-result catalogue. Device geolocation was not requested.
- Post-deployment Arc: onboarding displays real Studio navigation and `Boutique registration`, with no sample boutique or Analytics link. Signed-out Save redirected to Google login with the catalogue return path preserved. Raghava login returned to that path. Saved Studio Vanya, reloaded and observed the saved heart restored, confirmed it in `/saved`, then removed that test-only save to restore the original state. No other saves were removed.
- Commit `5f694c2` deployed successfully to all three Vercel apps. All 36 anonymous smoke checks passed again after deployment.
- Fresh GitHub run `40453669898` for `5f694c2`: **database job passed**, including 474 SQL/RLS tests in 25 files, local auth/catalog tests, Marketplace/Studio builds and the configured request/offer/order/design/production/appointment/fulfilment/aftercare/message/Studio integration suites. Logged milestones include 31 request checks, 32 offer/sharing checks, 44 messaging checks and 49 Studio overview/portfolio checks. These are isolated CI fixture tests, not proof of live business approval or real provider delivery. All three container jobs passed; quality failed only at dependency audit.
- Previously verified in this same audit sequence: Studio account and registration form as Raghava; Admin Google login → owner-completed MFA → AAL2 dashboard, directory, pending verification detail, orders and manual deliveries. The pending boutique has no verification submission. These reads do not prove approval mutations.
- `npm run test`, `npm run test:request-flow`, `npm run test:studio-storefront`, `npm run test:payments`: exited successfully. Generic package tests contain placeholders and an Admin HTTP test can skip without a local server; these are not comprehensive E2E evidence.
- `npm run test:flow-regressions`: **6 passed**, covering progress summary, saved-state lookup scope/idempotent insertion and source regressions for onboarding/cover rendering.
- `node scripts/test-studio-storefront.mjs --database`: isolated native PostgreSQL passed profile initialization/backfill, atomic updates, stale/foreign owner/cover rejection and public visibility gates. No hosted writes or Docker startup.
- Lint, typecheck and build validation performed for fixes. Build uses CI-style placeholder public Supabase values; it proves compilation, not a working live provider.

## Defects fixed

| ID    | Flow    | Defect                                                                                                                           | Change and regression boundary                                                                                                                                                                                                                         |
| ----- | ------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-101 | S01     | Registration inherited a sample boutique name and dead Analytics navigation from the legacy shell.                               | Uses the real Studio shell with a registration label; source regression checks the shell and absence of legacy labels/links.                                                                                                                           |
| F-102 | S01     | Registration could leave a busy form after an interrupted request and exposed raw database errors.                               | `try/catch/finally`, retained entered values, trimmed fields, city length bounds and actionable duplicate-handle/general error messages. Real owner submission still needs an approved fixture.                                                        |
| F-103 | C10/X07 | Order milestone always said “Production not started,” regardless of persisted progress.                                          | Derives latest stage/note; distinguishes no update from failed query. Unit cases cover latest stage, missing note, invalid stage and failed read. No live paid-order mutation was performed.                                                           |
| F-104 | C04/X02 | Saved boutique covers rendered storage keys as raw background URLs.                                                              | Uses the same uploaded/Stitch image resolver as the catalogue, with placeholder behavior. Source regression; live uploaded-cover fixture still needed.                                                                                                 |
| F-105 | C04     | Public discovery initializes all hearts as unsaved; a page reload could show the wrong saved state and repeat insert could fail. | Non-blocking own-state restoration, auth-change refresh, stale-read guard and ignore-duplicate inserts. RLS remains authoritative; discovery SSR stays public. Unit tests and live save/reload/saved-page/remove round-trip passed; test save removed. |

## Coverage against planned flows

`PARTIAL` means specific steps/evidence passed, not the complete flow. `BLOCKED` means required fixture/provider is missing. `NOT RUN` is deliberately different from a pass.

| Flow | Result this audit | Remaining proof                                                                                                                            |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C01  | PARTIAL           | Email verification/recovery delivery, invalid-password and expiry mutation branches; Google access/callback reads checked.                 |
| C02  | PARTIAL           | Phone touch/swipe, reduced-motion, mobile drawer and full search/filter matrix beyond observed desktop interaction.                        |
| C03  | PARTIAL           | Manual Hyderabad city filter passed; device permission and map pin search/geocoder branches not run.                                       |
| C04  | PARTIAL           | Boutique save/reload/saved-page/unsave live round-trip passed and cleaned up; uploaded-cover and other-user cases still need fixtures.     |
| C05  | PARTIAL           | Request-flow/measurement-reference regression tests passed; full signed-in six-step wizard with uploads/concurrency not performed.         |
| C06  | BLOCKED           | Submitted owned request and shared/unshared boutique fixtures.                                                                             |
| C07  | BLOCKED           | Two controlled offers, expired/withdrawn variants and acceptance fixture.                                                                  |
| C08  | BLOCKED           | Razorpay test configuration, controlled order and webhook. No real charge permitted.                                                       |
| C09  | PARTIAL           | Signed-in account read; structured-address edit and checkout propagation not performed.                                                    |
| C10  | PARTIAL           | Anonymous protection and stage-label tests passed; populated order actions need fixtures.                                                  |
| C11  | PARTIAL           | Pages load; no enquiry/email/phone action submitted; legal approval not implied.                                                           |
| S01  | PARTIAL           | Signed-in registration form and navigation defect identified/fixed; no boutique created.                                                   |
| S02  | BLOCKED           | Owner-authorized genuine verification details/documents and a complete submission.                                                         |
| S03  | PARTIAL           | Isolated database save/visibility tests passed; live owned boutique save/preview not performed.                                            |
| S04  | PARTIAL           | Storage/upload core tests passed; full owned portfolio publish/archive UI needs fixture.                                                   |
| S05  | BLOCKED           | Active shared request with controlled consent scope.                                                                                       |
| S06  | BLOCKED           | Shared request and quotation fixture.                                                                                                      |
| S07  | BLOCKED           | Paid order and design/production state fixtures.                                                                                           |
| S08  | BLOCKED           | Eligible controlled order and appointment slot.                                                                                            |
| S09  | PARTIAL           | Studio account read passed; name/phone mutation and assigned/revoked staff fixture not run.                                                |
| S10  | BLOCKED           | Shipment and aftercare order fixtures.                                                                                                     |
| A01  | PARTIAL           | Live Admin Google/MFA/dashboard verified; sign-out/expiry and other-role UI matrix not repeated.                                           |
| A02  | PARTIAL           | Directory/current storefront/unsubmitted verification detail observed; no approval/rejection/suspension mutation.                          |
| A03  | PARTIAL           | Order page/empty state observed; populated detail/address audit needs fixture.                                                             |
| A04  | PARTIAL           | Manual-delivery queue/empty state observed; no tracking recorded or courier booked.                                                        |
| A05  | BLOCKED           | Support case/refund fixture and test-mode payment provider.                                                                                |
| A06  | PARTIAL           | Audit/readiness visible through dashboard; no enquiry/configuration mutation.                                                              |
| X01  | PARTIAL           | Current pending/private and approved/public boundaries verified; submission → decision round-trip not performed.                           |
| X02  | PARTIAL           | Shared database relationships inspected, profile initialization and public read gates tested; live edit reflection requires owned fixture. |
| X03  | BLOCKED           | Request/share/private-file end-to-end fixture.                                                                                             |
| X04  | BLOCKED           | Quotation/acceptance fixture.                                                                                                              |
| X05  | BLOCKED           | Controlled captured test payment/webhook/order.                                                                                            |
| X06  | BLOCKED           | Paid order/design-review versions.                                                                                                         |
| X07  | PARTIAL           | Persisted-stage rendering regression fixed; full Studio → Customer → Admin update awaits order fixture.                                    |
| X08  | BLOCKED           | Order/slot fixture.                                                                                                                        |
| X09  | BLOCKED           | Daily configuration and authorized measurement appointment. Recording remains off.                                                         |
| X10  | BLOCKED           | Order participants and lifecycle fixtures; completed-order chat policy still needs resolution.                                             |
| X11  | BLOCKED           | Paid, production-ready order and authorized manual shipment fixture.                                                                       |
| X12  | BLOCKED           | Delivered/completed fixture with aftercare.                                                                                                |
| X13  | BLOCKED           | Controlled support/cancellation/refund fixture/provider.                                                                                   |
| X14  | NOT RUN           | Authorized controlled contact enquiry and Admin processing.                                                                                |
| X15  | BLOCKED           | Controlled recipient list, dispatcher/provider configuration and correlated events. Outbox/unit tests alone are not delivery proof.        |

## Environment and unresolved findings

1. `npm run test:auth` could not start **on this Mac** because `supabase status` depends on the unavailable local Docker socket. Docker was not started here. The fresh GitHub database job subsequently ran the configured full-stack fixture suites successfully in its isolated environment. Native PostgreSQL checks above remain narrower, and no CI fixture result is described as a live-provider result.
2. Existing GitHub run `40450907666` passed its database job (which includes local-Supabase HTTP journeys) and all container jobs. Its quality job failed at `npm audit --omit=dev`: Next, Nodemailer and Zod advisories. This is separate historical CI evidence, not this run's live E2E result. Dependency changes overlap pre-existing uncommitted Sentry/lockfile work; they were preserved, not silently bundled into these fixes.
3. No real document upload, business approval, payment/refund, courier booking, video room or email send was performed. Existing test identities do not contain the complete fixtures needed for these branches.
4. The map filter explicitly matches boutique cities, not exact radius/distance. Materials discovery lists designs by fabric rather than stocked fabric inventory. Do not promise functionality beyond those semantics.
5. Current messaging primarily excludes cancelled orders. Strict active-only versus completed-order aftercare messaging remains a product/implementation decision, not marked passed.

Next execution requirement: controlled owner/customer/boutique/order fixtures with genuine authorized verification documents, then X01 → X04, Razorpay test capture X05, and fulfilment X06 → X13. Provider and email tests must use controlled recipients/test credentials. Do not manufacture live state with direct SQL to claim UI success.
