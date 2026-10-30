# Live dcedf order journey

Last checked: 30 October 2026. **Partial pass; not an end-to-end delivery pass.**

## Scope

User authorized the existing approved boutique `dcedf`, one explicitly labelled test portfolio item, a test quotation, and acceptance to create an unpaid order. No real money, manufacturing or courier activity was authorized or performed. Hosted payment records were not fabricated and payment gates were not bypassed.

## Fixture references

- Boutique: `21081f53-7acb-4045-ab20-36d1d5cb7ace` (`dcedf`).
- Design: `a9f418cc-b8dd-48b5-9972-f75cf00adf5d` (TEST ONLY - Silk Ensemble).
- Request: `aba1e4cd-6df8-4774-a7ec-a0217a76cdc1`.
- Boutique share: `6060124c-7eb1-4e4a-85d5-3389f22dd992`.
- Quote: `98c55aa2-0aad-4568-ba67-bf508f4348de`.
- Order: `25411eb8-e83f-4b7a-a18d-3ef1420b921d`.
- Quote total and advance: INR 100; remaining balance INR 0. Terms explicitly say TEST ONLY, no real purchase, production or delivery.

## Verified through live UI

1. Added a clearly labelled test design through Studio, including image upload.
2. Customer completed and submitted the six-step request, then shared its basic brief with dcedf. Measurements and inspirations were not shared.
3. Boutique saw the shared brief and sent an itemized INR 100 quotation.
4. Customer saw the quotation. After explicit action-time confirmation, accepted it on 27 October; the application created one unpaid test order.
5. Customer checkout and order detail showed the immutable quote and awaiting-payment/test-mode status.
6. On 30 October, Dia displayed the same order in Studio's Orders list and detail: payment pending, production not started, order active, correct quote terms and amounts.
7. Boutique sent labelled test message #1. Customer saw it as an order-partner message with one unread message.
8. Customer sent labelled test reply #2; both messages appeared in customer history after the server reload.

## Blockers and unverified stages

- Checkout reports **Razorpay test checkout setup pending**. No provider payment was attempted. Production, design approval, fulfilment and delivery cannot be claimed as passed for this live fixture.
- Code readiness requires valid `RAZORPAY_KEY_ID` test credentials, `RAZORPAY_KEY_SECRET`, and server-only `SUPABASE_SECRET_KEY`. The UI does not establish which value is absent. Do not expose secrets in reports or enable real payments to bypass this test blocker.
- User completed Admin MFA directly. Admin Orders lists this fixture with the correct customer, boutique and INR 100 total, Unpaid payment and Not eligible shipping. Detail failed with "This order is unavailable": its RPC referenced nonexistent `profiles.email`. Migration 046 corrects the lookup to `auth.users`, preserving the AAL2 gate. It is pushed and database CI passed, but **hosted rollout remains pending**: native Dia editor state and keyboard input were inconsistent, so no SQL Run action was performed. `docs/sql/APPLY_046_ADMIN_ORDER_DETAIL.sql` contains the atomic manual rollout and migration recording. No MFA weakening was performed.
- Actual physical delivery is outside this fictional test; do not mark a fictional parcel as truly delivered.
- Earlier Arc blank rendering was not reproduced on the Studio Orders list in Dia. No root cause or application fix is claimed for the Arc symptom.
- Email receipt, read receipts, customer-reply visibility from Studio, and unrelated-user chat denial were not verified in this live run.

## Fixes

- Already pushed: `dabbd48`, `dab347a`. Portfolio images now use original public object URLs rather than Supabase image transforms unavailable on this free tenant. Incomplete boutique profiles no longer display invented response-time or empty experience facts. Portfolio setup copy no longer calls the live site staging.
- This follow-up changes chat copy from misleading "Staging conversation" to "Private order conversation". No authorization or notification behavior changes.

## Follow-up validation

- `npm run typecheck --workspace=@faden/ui`: pass.
- `npm run test --workspace=@faden/ui`: pass, 3 upload tests (not chat HTTP coverage).
- Live chat: message #1 received by customer and reply #2 saved; no simulated SQL writes used.
- Studio production page displayed "Customer design approval is required before recording progress" with no progress recorded.
- Commit `0dd7044`: CI run `41009870067` database job passed, including SQL regression tests; all three container jobs passed. Overall CI is not green: quality failed at the existing dependency audit; the earlier run passed format, lint, typecheck, application tests and build before audit.
- No hosted migrations were applied during this follow-up.

Resume using this existing order rather than creating duplicate fixtures. Apply migration 046, verify Admin detail, configure genuine Razorpay test checkout, and then test payment/design/production transitions without real manufacturing or shipping.
