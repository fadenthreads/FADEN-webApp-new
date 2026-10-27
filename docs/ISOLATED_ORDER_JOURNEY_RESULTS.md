# Isolated boutique-to-delivery test — 27 October 2026

## Result

**PASS: 31 named journey assertions**, plus the HTTP/RPC/storage assertions between them, on one newly registered boutique and one accepted order. This is an isolated application/database integration test, not a live-provider or visual browser test.

Evidence: [GitHub CI run 40481498226](https://github.com/fadenthreads/FADEN-webApp-new/actions/runs/40481498226), database job `122112656945`, tested implementation commit `18685ab`. Fresh local Supabase and all three built applications ran on the CI runner. Docker was not started on the user's Mac. No hosted migrations or production business mutations were performed.

## Connected journey executed

1. Bootstrap three fresh labelled identities (customer, owner, MFA Admin). Only identity creation/Admin-role bootstrap uses the service client here.
2. Register the boutique through the normal owner RPC. Assert pending status and absence from public catalogue.
3. Create the owner verification draft through Studio HTTP. Check AAL1 Admin denial, AAL2 denial before submission, and missing-document submission denial.
4. Upload three synthetic `TEST-ONLY` placeholder images through signed Storage uploads, attach them to the submission, then submit. These are not genuine identity/business documents.
5. Approve through the AAL2 Admin HTTP endpoint. Assert the same boutique becomes verified, published and readable through public RLS; load its customer page.
6. Customer creates, saves and submits a request for that boutique, then explicitly shares it. Studio renders the customer's actual brief.
7. Boutique sends its quotation through Studio HTTP. Customer accepts through Marketplace HTTP. Repeat acceptance returns the same order ID.
8. Open that order in Customer, Studio and Admin; assert no unpaid receipt.
9. Use the existing service-only **test payment simulator** to reserve, attach and record capture. Retry capture. The customer cannot invoke the trusted simulator and the receipt says “No real money collected.” No Razorpay API, checkout widget, signature or webhook was exercised by this journey.
10. Owner uploads a private design sketch and publishes it. Production is rejected before customer approval. Customer approves; owner sends all five production stages; customer journey renders.
11. Customer delivery page exposes the address form. Save the fictional address through HTTP; Admin reveals the same address with an access reason.
12. Deny boutique access to Admin shipping actions. Admin records booked → picked up → in transit → out for delivery → delivered, using explicitly synthetic carrier/tracking labels. Customer and boutique see each status but not private Admin notes.
13. Check both UI and API prevent address edits once shipping starts. Customer completion and aftercare pages load, and a customer review is accepted after simulated delivery.

Fixture references recorded by that run (CI-only; not production links):

| Entity   | ID                                     |
| -------- | -------------------------------------- |
| Boutique | `3f204a40-c625-43f3-9a2e-60504e4bf0be` |
| Request  | `f55461fa-17c6-4989-aa0a-f2defc2c3460` |
| Offer    | `1cd37e59-8783-48f1-8ca3-b8c8c45100ec` |
| Order    | `10e1f9bc-4741-4070-9f17-73f202e180bd` |

## Defects fixed

| Defect                                                                                                              | Fix                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh registration created `pending_verification`, but draft creation accepted only `draft`/`rejected`.             | Append-only migration `202610270043_registration_verification_flow.sql` admits new pending boutiques while preserving ownership/validation and blocking duplicate active applications. Five SQL regression assertions cover the real registration boundary. |
| Live customer tracking page offered no way to enter a delivery address; the endpoint gated addresses as rehearsals. | Added accessible, responsive address form to the protected delivery page. Authenticated customer address saves work independently of rehearsal flags; synthetic shipment actions remain gated.                                                              |
| Address RPC knew only legacy rehearsal shipments, allowing direct address changes after manual shipment booking.    | Append-only migration `202610270044_manual_delivery_address.sql` blocks edits for active manual shipments and serializes manual shipment writes against the order lock. Existing revision/idempotency/validation checks remain.                             |

## Validation

- Database job: **passed**, including migrations from reset and **479 SQL/RLS tests in 26 files**.
- New connected journey: **31 named checks passed**.
- Existing suites passed: 31 request, 32 offer/sharing, 62 order/payment, 45 design, 43 production, 73 appointment, 56 fulfilment, 48 aftercare, 44 messaging, 49 Studio checks, plus auth/catalog/Marketplace suites.
- All three application builds and container jobs passed.
- Quality checks passed through build, then failed at the pre-existing dependency audit: Next (critical), Zod (high), Nodemailer (moderate). **Overall CI is not green.** No forced dependency rewrite was mixed into unrelated uncommitted Sentry/lockfile work.
- Local lint, typecheck, package tests and existing flow regression tests passed. The local Admin HTTP unit suite skips without its running server; the new CI journey explicitly starts and tests Admin.

## Limits and rollout

- No real money, courier, genuine business documents, email send or Daily room. This is not proof of those providers working.
- HTTP/server rendering and RLS are covered, not every browser click, responsive layout, swipe or upload interaction. Completion/rehearsal copy and the broader 42-flow matrix are not all certified by this run.
- CI fixtures belong to the disposable runner database. They are not usable accounts/orders on `faden.in`.
- Subsequent rollout update: after explicit user confirmation on 27 October 2026, migrations **043–045 were applied to hosted Supabase**, with history/function/permission checks and 36 live anonymous smoke checks passing. This later rollout is separate from the isolated test evidence above; it did not approve a production boutique. See `DOCUMENT_FREE_APPROVAL.md`.
- Before public launch, resolve the dependency audit and run controlled provider/browser acceptance tests. Do not present this isolated pass as complete production readiness.

## Repeat

On an isolated machine/CI runner with local Supabase running: reset migrations, seed local auth/catalogue fixtures, run `npm run env:local`, build and start Marketplace/Studio/Admin on ports 3000/3001/3002, then run `npm run test:complete-order`. The harness refuses non-local Supabase URLs. It deliberately retains labelled fixtures within that local database for diagnosis; CI runner disposal removes the environment.
