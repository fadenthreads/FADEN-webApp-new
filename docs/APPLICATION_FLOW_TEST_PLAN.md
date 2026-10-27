# FADEN application flows and test plan

Prepared: 27 October 2026. This is a journey/test plan, not an implementation-completion claim. No application settings, approvals, orders, payments or emails should be changed merely by following the planning sections.

## 1. Scope and conventions

Applications:

- **C — Customer:** https://faden.in
- **S — Studio:** https://studio.faden.in
- **A — Admin:** https://admin.faden.in

A path belongs to the app named beside it. `{request}`, `{offer}`, `{order}`, `{boutique}` and `{slug}` are IDs/handles captured during the test, never guessed. Capture the same reference across applications. A flow can stay on one page, span several pages in one app, or cross apps.

Priority: **P0** = required to accept and fulfil a first order; **P1** = important operating/recovery experience; **P2** = secondary convenience. Run negative authorization checks beside their parent P0 flow, not as an optional final security phase.

Readiness labels:

- **Observed:** the stated read/login behavior was checked live; mutations are not implied.
- **Candidate:** routes/code exist; this flow still needs execution.
- **Needs fixture:** requires a suitable request, boutique, document, offer or order first.
- **Integration-gated:** provider/configuration is required; do not report a demo or disabled button as a pass.
- **Decision/gap:** expected product behavior needs a decision or implementation verification.

Source precedence: current routes/migrations and observed behavior take precedence over older implementation-plan wording. In particular, current boutique approval publishes the boutique; later Admin hiding/suspension overrides it. Manual shipping replaces Shiprocket. Payment capture, not accepting an offer, qualifies an order for shipping.

## 2. What we know today

| Area                         | Evidence and limitation                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer/Studio Google login | Studio account/settings and registration form accessible as `raghava4272@gmail.com`; that account has no boutique application.                                                  |
| Admin login                  | `fadenthreads@gmail.com` already has the Admin role. Google login, owner-completed MFA and AAL2 dashboard access verified.                                                      |
| Admin callback               | Missing `https://admin.faden.in/**` redirect added with owner confirmation; callback-error handling deployed to all three apps.                                                 |
| Boutique review              | Directory and pending-boutique detail accessible; the existing pending application has **not submitted verification**. No approval was performed.                               |
| Public gate                  | Pending `dcedf` returned 404 and was absent from discovery; approved `studio-vanya` loaded and appeared in discovery.                                                           |
| Orders/delivery              | Admin pages load with empty results; no live order mutation has been verified.                                                                                                  |
| Database                     | Migration `202610260042` recorded, storefront RPC exists, zero missing boutique-profile rows. Isolated database tests passed.                                                   |
| Providers                    | Admin readiness showed Razorpay and Daily not configured, SMTP enabled but live workflows disabled. Recheck before testing; stored email templates alone do not prove delivery. |
| CI                           | Database/container jobs passed on `a1a94ed`; quality failed at dependency audit. Do not call the entire launch gate green.                                                      |

## 3. Test identities, data and safety

Use separate browser profiles/sessions so Google account selection or sign-out in one app does not accidentally replace another tester. Always check the displayed account email before a mutation. Do not assume an app's login signs the other app in or out.

| Fixture                         | Purpose                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| C1 customer                     | Own requests, measurements, offers, orders and messages.                                                                            |
| C2 unrelated customer           | Must not access C1's private records/files.                                                                                         |
| S1 boutique owner               | Registration, verification, storefront, quotations and fulfilment. Existing Raghava account can be used only with agreed test data. |
| S2 other boutique owner         | Sharing/offer isolation; foreign order/file denial.                                                                                 |
| ST assigned staff               | Check actual portfolio permission separately from owner-only business/order actions. Do not assume staff invitations work.          |
| A1 Admin                        | FADEN Admin account with MFA completed by the owner.                                                                                |
| B1 pending → submitted          | Fresh controlled application with owner-authorized genuine business information/documents.                                          |
| B2 approved/published           | Storefront and catalogue edit fixture.                                                                                              |
| B3 approved/hidden or suspended | Public visibility and write-permission boundaries.                                                                                  |
| R1/R2                           | Submitted request shared with S1; private/unshared request.                                                                         |
| O1–O4                           | Unpaid accepted order; captured test order; in-production order; delivered/completed order.                                         |

Keep a test-run record of emails, application IDs, request/offer/order IDs, prior values and timestamps. Do not put passwords, MFA codes, document contents, precise addresses, measurement values, payment signatures or signed URLs into screenshots/logs/reports.

Mutating end-to-end tests belong in a controlled test environment using the **same schema and gates**. If live testing is necessary, agree on a visibly labelled test boutique and cleanup/visibility rules first. Never fabricate legal documents, approve a real business as a shortcut, collect real money, book a courier or send real customer notifications as a smoke test. Existing production data is read-only unless a specific change is authorized. Preserve MFA, RLS and approval gates. Do not reset hosted Supabase.

Do not enable the global live-workflows flag merely to make one test pass: it can affect other configured providers. Use Razorpay test mode, explicitly controlled email recipients and Daily test sessions. Leave Shiprocket and phone OTP out of launch testing. Mark gated flows **BLOCKED**, not passed.

## 4. End-to-end journey map

```text
S registers boutique → S submits documents → A reviews/decides
    → approved/public boutique becomes discoverable to C
S prepares storefront and portfolio → C sees approved public content
C creates request → C explicitly shares → S reviews → S sends quote
    → C compares/accepts → one unpaid order exists in C/S/A
C confirms delivery details/policies → test payment captured
    → C/S/A see verified payment → order qualifies for manual delivery queue
S submits design → C approves or requests revision → S updates production
S offers session → C books → in-person session OR gated Daily call
C ↔ S order chat; significant events → controlled email outbox/dispatch
S finishes production → A arranges courier externally and records tracking
    → C/S see shipment updates → delivery → completion/aftercare
Exception branch: cancellation/support → A review → gated refund confirmation
```

Sessions are an optional branch at the stage permitted by the actual order rules; do not force video measurement into every order. A shipping queue entry is not permission to ship an unfinished garment. Check both payment and production readiness before dispatch.

## 5. Single-app flows

Every flow below must include refresh/reopen persistence, clear empty/error states and a narrow/mobile viewport where relevant. Routes existing in source are not proof their mutations work.

### Customer flows

**C01 — Google/email account entry and recovery — P0 — Candidate; Google read access observed**

- Paths: `/auth/sign-in` → `/auth/callback` → intended local destination; `/auth/forgot-password` → email link → `/auth/update-password`; `/account` → sign out.
- Test Google selection and email sign-up separately. For email sign-up, verify delivery, confirmation and subsequent sign-in. Test an existing account, invalid credentials, cancelled Google consent, expired callback and password-reset reuse.
- Expected: correct account and return page; failed/expired callback has a retry message, not a fake session. External/malformed `next` cannot redirect off-app. Protected deep links require authentication; browser Back after sign-out cannot restore access.
- Password/MFA entry remains user-operated. Google app branding is a separate configuration check, not evidence that a session exists.

**C02 — Homepage, mobile navigation and discovery — P0 — Candidate**

- Paths: `/` → Home/Boutiques/Designs/Materials/Atelier; `/discover?type=boutiques|designs|materials`; mobile hamburger → registration and `/style-assistance`.
- Exercise each homepage loop, swipe/manual navigation and card quick-view. Open/close with tap, Escape and Back; open the intended boutique/design/material collection from the popup. Repeat quick-view on category pages.
- Search, clear, change category, apply filters, use Back/Forward and refresh the URL. Try no matches and slow results.
- Expected: correct card/destination and filters; no overlapping carousel copies catching taps, vertical-scroll hijacking, body-scroll lock after close, hidden mobile controls or stale results. Materials may lead to a matching collection, not a standalone material checkout.

**C03 — Location-based discovery — P1 — Integration-gated/needs fixture**

- Path: discovery location control → detect location OR manually choose supported place/map position → filtered boutiques.
- Test permission allowed/denied, unavailable GPS, typed city, position change, radius if exposed, clear/reset and no nearby boutiques.
- Expected: visible location/filter state and correct matching results. Denial still allows manual selection. Do not claim a map picker is implemented until the actual UI supports it; location/address autocomplete alone is not a map picker. Precise coordinates are not public.

**C04 — Browse, save and revisit — P1 — Candidate**

- Paths: `/boutiques/{slug}` or `/designs/{slug}` → save → `/saved` → reopen → unsave.
- Expected: correct saved record for C1 only, duplicate taps do not create duplicates, refresh retains state, C2 has a separate collection. A removed/hidden design or boutique does not leak stale private content. Cover keys resolve to images rather than broken raw storage keys.

**C05 — Outfit wizard, editing and resume — P0 — Candidate**

- Paths: `/create` → `/create/{step}` for all six steps → review/edit/back → save and continue → exit and resume.
- Cover preset and custom occasion; custom silhouette input; colour selection/palette and free-text intent; neckline, sleeves and fabric preferences. Check that custom values persist, not just their radio selection.
- Step 4: enter garment-relevant measurements OR upload a chart/photo reference, enlarge/view guide, use measurement-method controls and confirm they scroll to the correct section. Confirm units, consent and irrelevant fields not being required.
- Step 5: date/budget constraints and requested delivery wording; step 6: every Edit link returns to the correct populated step and comes back with the change saved.
- Try save twice, rapid Next/Back, double-click, refresh during autosave, a failed upload, concurrent tabs and a submitted draft. No data loss or silently overwritten newer draft; explain conflicts and preserve recoverable input rather than blindly hiding them.
- Expected: one stable draft ID, correct latest review, safe recovery and no boutique access until explicit sharing. If any requested option/UI is absent, record a feature gap rather than assuming it exists.

**C06 — Request history and share management — P0 — Needs fixture**

- Paths: `/requests` → `/requests/{request}` → select approved boutique(s) and permitted data → share → inspect share → revoke.
- Expected: correct submitted request, actual selected boutiques, server-enforced sharing limit, visible consent scope, duplicate-share safety and revocation. Refresh confirms the persisted state. Private inspiration and measurement references remain private files.

**C07 — Offer comparison and selection — P0 — Needs fixture**

- Paths: `/offers` → `/offers/{offer}` → `/offers/compare` → decline or accept.
- Compare garment/material scope, total/tax, deposit if supported, lead time, expiry, exclusions and boutique identity. Test one versus several offers, expired/withdrawn/declined offers and repeated accept.
- Expected: accurate comparison and immutable accepted terms; one order for duplicate acceptance. Distinguish **accepted/unpaid** from **payment captured**. Negotiation/revised quotation is a separate flow if there is no edit-after-send UI.

**C08 — Checkout, receipt and printable order record — P0 — Integration-gated**

- Paths: `/orders/secure?id={order}` → test checkout → `/orders/{order}/receipt` and `/invoice` → order hub.
- Check structured address, policy consent, locked paise totals, successful/failed/closed checkout, retry, reload and delayed webhook. Do not manipulate a browser response to mark capture.
- Expected: only verified provider capture establishes payment success; correct test-mode label, amount and payment reference; invoice/receipt inaccessible to other users and unavailable when unqualified. Test print/save-as-PDF; this is not a promise of a legally compliant seller GST invoice.

**C09 — Account profile and delivery address — P1 — Candidate**

- Path: `/account`; edit name/contact phone/default structured address/preferences → save → reload → checkout.
- Expected: persisted own-account data, correct checkout address behavior, required postal/phone validation, Google identity shown accurately, transactional versus marketing preference semantics clear. Existing accepted orders must not silently change delivery address merely because the default address changed; record supported order-address correction path.

**C10 — Order hub and customer actions — P0 — Needs fixture**

- Paths: `/orders` → `/orders/{order}` → design approval, appointments, messages, `/journey/{order}`, delivery, receipt/invoice, complete and aftercare.
- Expected: every link carries the same order; statuses/totals align; no hardcoded “Production not started” after production begins; unpaid/cancelled/completed states expose only eligible actions. Opening another user's ID is denied without revealing details.

**C11 — Contact, help, policies and stylist enquiry — P1 — Candidate**

- Paths: `/help`, `/contact`, `/style-assistance`, `/terms`, `/privacy`, `/shipping-policy`, `/refund-policy`, `/cancellation-policy`, `/measurement-privacy`.
- Send one authorized controlled enquiry, verify validation/confirmation, test phone/email links and shopper/stylist mailto content.
- Expected: enquiry is not represented as a confirmed booking or payment; published contact information is consistent. Legal/business approval is a separate launch dependency—rendered pages do not establish legal approval.

### Studio flows

**S01 — New-owner registration — P0 — Form observed; mutation needs fixture**

- Paths: sign-in with `next=/onboarding` → `/onboarding` → create boutique → `/verification` → `/` setup checklist.
- Test required fields, public-handle formatting/uniqueness, duplicate submit, session expiry and retry.
- Expected: one pending boutique, owner membership and initialized profile; no public exposure. Existing owner resumes workspace instead of creating another application. No unrelated seeded name such as “Aarya Studio” should label a new applicant; capture that legacy-shell issue if still present.

**S02 — Verification preparation and submission — P0 — Needs genuine documents**

- Path: `/verification`; save legal/contact details → attach required business/PAN/address documents and conditional GST information → reopen draft → submit.
- Test permitted image/PDF uploads, size/type restrictions, replace/remove, failed upload, missing fields/documents and double submit.
- Expected: saved draft differs visibly from submitted review; only valid complete submission enters review. Submitted snapshot is locked; owner can see Admin feedback and correct a changes-requested submission. Do not fabricate PAN or business documentation.

**S03 — Storefront editing and preview — P0 — Needs owned boutique**

- Path: `/storefront`; name/city/introduction/story/services/specialties/starting price/lead time/availability → owned published-image cover → preview → save twice → reload.
- Repeat while pending and while approved/public. Test stale second tab, foreign cover and invalid pricing/date/range.
- Expected: atomic save, newest version retained, local preview distinguishes private versus live. Pending save stays private; approved/public edits appear without repeat Admin approval. Hidden/suspended boutiques remain hidden. Cover selection is not a dedicated logo/brand-asset uploader.

**S04 — Portfolio lifecycle — P0 — Needs fixture**

- Path: `/portfolio`; create design draft → upload image → save metadata → edit → publish when eligible → archive/unpublish → remove unused image.
- Expected: image key persists, display URL resolves, no distortion, failed upload creates no false saved item. Pending owners can prepare drafts but cannot bypass public gate; currently referenced design/cover objects cannot be deleted. Assigned staff access is checked independently.

**S05 — Request inbox and full brief — P0 — Needs shared request**

- Paths: `/requests` → `/requests/{request}` → quotation entry.
- Expected: customer intent, references, garment choices, budget/date and consented measurements visible only within granted scope. Revoked/unshared requests cannot be reopened by ID or cached file link beyond the allowed signed-link lifetime. No fabricated “accept request” button: if receiving/sharing enables quote creation directly, test that actual transition.

**S06 — Quotation lifecycle — P0 — Needs fixture**

- Paths: `/offers/new` from the request → save draft → `/offers/{offer}` → send → withdraw where supported.
- Expected: required line items/amounts/timing/expiry, accurate paise totals, clear draft/sent status, immutable sent/accepted quote, stale-edit protection. Customer receives only the intended offer. Editing sent quotations must use the supported new-offer/revision route, not mutate accepted terms.

**S07 — Order workbench and progress — P0 — Needs captured order**

- Paths: `/orders` → `/orders/{order}` → `/design` and `/production`; also `/production` board.
- Expected: unpaid orders cannot enter production; design submission/revision and stage sequence are enforced, progress photos/notes survive refresh, repeated commands do not duplicate events. List, board and detail agree on stage. Record delay and customer-update behavior where exposed.

**S08 — Measurement scheduling — P0 for appointment branch — Needs fixture**

- Path: `/appointments`; create slot with explicit timezone, kind and location → reserve/rebook/cancel → complete/no-show; withdraw an unused slot.
- Expected: correct IST display and stored timestamps, end after start, no double booking, confirmed cancellations/reschedules, history preserved. In-person appointments must not require a Daily key.

**S09 — Account and membership boundaries — P1 — Account read observed**

- Path: `/account`; save own display name/contact phone → reload. Open portfolio as assigned staff; attempt owner-only storefront/verification/order operations as staff.
- Expected: personal edits do not change login email, verified business identity or role. Owner-only restrictions are clear. No complete team-invitation management is assumed. Password/email/ownership/legal changes follow supported support/authentication paths.

**S10 — Shipping awareness and aftercare work — P1 — Needs fixture**

- Paths: `/orders/{order}/delivery` and `/orders/{order}/aftercare`.
- Expected: Studio reads Admin shipping updates without overwriting them; delivered-order aftercare can receive and respond to customer review/alteration requests using allowed statuses. No claim that Studio books a courier automatically.

### Admin flows

**A01 — Secure entry and overview — P0 — Observed**

- Paths: Google sign-in → `/auth/callback` → `/auth/mfa` → `/` → sign out.
- Expected: actual FADEN Admin identity + AAL2, real metrics, no access for ordinary customer/owner/AAL1 Admin. Lost/expired session prompts reauthentication; do not disable MFA to continue. Overview readiness is configuration evidence, not a successful provider transaction.

**A02 — Boutique operations — P0 — Read observed; decisions need submission**

- Paths: `/boutiques` → search/filter/sort/paginate → `/boutiques/{boutique}/verification`.
- Inspect owner, submitted business snapshot, private document links and separate current storefront content. Exercise approve/request-changes/reject only on agreed complete fixtures, with reason/confirmation.
- Expected: no decision on an unsubmitted application; private documents scoped to authorized AAL2 Admin; immutable history, owner feedback and correct publication outcome. Suspend/hide/reactivate only on designated test boutiques; never alter unrelated seeded/live listings as a smoke test.

**A03 — Order lookup and operational detail — P0 — Empty list observed**

- Paths: `/orders` → search/filter → `/orders/{order}`; inspect accepted terms, payment attempts, design/production/appointment/message metadata, support and timeline.
- Expected: accepted unpaid and captured orders represented accurately; filtering/pagination stable, monetary units correct. Address reveal requires explicit reason and audit; private Admin notes must never appear in customer/Studio pages or emails.

**A04 — Manual delivery — P0 — Empty queue observed; actions need fixture**

- Paths: `/deliveries` or shipping-filtered orders → `/orders/{order}` → claim/reveal address → arrange courier outside app → record carrier/tracking/optional HTTPS link → update status.
- Exercise awaiting arrangement → booked → pickup → transit → out for delivery → delivered, plus exception/cancel paths **only where allowed by the transition model**.
- Expected: no shipping of unpaid/unfinished order, no false carrier event, one shipment, actor/timestamps/version recorded, duplicate saves safe, invalid URL/data rejected. A real booking is external and needs separate authorization; automated Shiprocket is excluded.

**A05 — Support, cancellation and refunds — P0 for exceptions — Needs fixture/provider**

- Path: `/orders/{order}` support section → internal note/customer-visible response/status → dedicated refund command when eligible.
- Expected: private/public note distinction, correct support status, no arbitrary refunded/payment-status edit; partial/full refunds await verified provider confirmation. Duplicate refund commands cannot issue extra money. Test mode only unless a specific real refund is authorized.

**A06 — Contact enquiries, audit and configuration — P1 — Candidate**

- Paths: `/contact-inquiries` → inspect/update controlled enquiry; `/audit` → related event; `/configuration` → readiness/operational configuration where implemented.
- Expected: correct enquiry and processing state, real actor/entity/time, no secrets in readiness/audit output. Do not change secrets or flags just to exercise a control.
- `/disputes` and `/settlements` currently render placeholders: assess honest unavailable navigation, not successful dispute arbitration or payouts. A disabled Security center is also not a completed workflow.

## 6. Cross-app flows — the primary acceptance suite

These combine the preceding flows. For each handoff record the source ID/version/status, refresh the destination, and check the same entity. Use an unauthenticated public session for visibility checks. Already-open pages may require refresh; explicitly test any advertised auto-refresh separately.

| ID / priority       | Journey and exact handoff                                                            | Pass criteria / important branches                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X01 / P0            | S01 → S02 → A02 → C02 → C boutique detail                                            | Complete application appears for Admin; approve publishes correct boutique; pending/rejected/hidden/suspended remain absent. Test request-changes → owner correction/resubmit → review, and rejection separately.                                                                                                         |
| X02 / P0            | S03/S04 → C homepage/discovery/detail/saved → A verification detail                  | Correct name/story/services/cover and published designs reflect after refresh; drafts/archived items stay hidden. Admin sees current public content separately from the immutable legal submission. Save pending content before approval, then verify it appears only after approval.                                     |
| X03 / P0            | C05 → C06 → S05                                                                      | Full submitted brief reaches exactly the selected boutique with exactly the granted files/measurements. No share means no access; revoke prevents subsequent access. Repeat with two boutiques with different sharing scopes.                                                                                             |
| X04 / P0            | S06 → C07 → C accept → S orders → A03                                                | Same quotation, price/timing and accepted snapshot; one order on double accept; customer decline/expiry/withdrawal branches handled; no premature payment/production state.                                                                                                                                               |
| X05 / P0            | C08 → verified Razorpay test webhook → C10/S07/A03/A04                               | Captured amount matches locked terms, receipt valid, order lists consistent, shipping queue entry created once. Pending/failed/closed checkout never qualifies as capture. Repeat webhook and browser reload.                                                                                                             |
| X06 / P0            | S design upload/revision → C `/orders/{order}/approval` → S `/design`                | Customer can approve or request changes on correct version; boutique sees decision; superseded design cannot be approved accidentally. Unrelated user/file download denied.                                                                                                                                               |
| X07 / P0            | S07 stage/note/photo update → C `/journey/{order}` and order hub → A03               | Same stage, photos and chronological note; correct payment/design preconditions; customer updates don't require reopening a different order. No duplicate/invalid skip or stale success after concurrent writes.                                                                                                          |
| X08 / P0 branch     | S08 slot → C `/orders/{order}/appointments` → S appointments → A detail              | Correct order/customer/session time/location; reserve one slot, compete for it, reschedule/cancel, record outcome. Video failure must not block in-person sessions.                                                                                                                                                       |
| X09 / P1 gated      | X08 video appointment → C + S join → Daily room → leave/rejoin/end                   | Correct private room and participant authorization/time window; expired/cancelled/unrelated access denied, recording off, key/token not exposed. If Daily unavailable show honest readiness; never test by fabricating a meeting URL.                                                                                     |
| X10 / P0            | C `/orders/{order}/messages` ↔ S same-order messages; A metadata                    | Authorized participants exchange one message each with correct order/history; wrong boutique/customer denied; no pre-order open chat. Cancellation blocks new messages. **Decision:** completed-order chat versus strictly active-order-only policy must be resolved; current source primarily excludes cancelled orders. |
| X11 / P0            | S production ready → A04 manual shipment → C delivery + S delivery + A timeline      | Same carrier/tracking/status/timestamps; optional link absent does not break display; exception shown honestly; delivered is not claimed before confirmed Admin update. Boutique/customer cannot mutate manual shipment.                                                                                                  |
| X12 / P1            | X11 delivery → C complete/aftercare → S10 response → C sees response                 | Correct completion eligibility, one review/alteration per applicable rule, accurate rating/status/history, no duplicate submission or premature aftercare. A sees support context when applicable, not unrestricted private content.                                                                                      |
| X13 / P0 exception  | C `/orders/{order}/support` or cancellation → A05 → test refund provider → C/S/A     | Case and response shared correctly; private notes isolated; cancellation does not imply money refunded; confirmed refund amount/status consistent, receipt remains truthful, shipping eligibility re-evaluated.                                                                                                           |
| X14 / P1            | C11 controlled contact form → A06 → record resolution                                | Exactly one enquiry with validation and correct Admin visibility. Styling mailto enquiry is distinct: opening an email client does not create an Admin enquiry automatically.                                                                                                                                             |
| X15 / P0 supporting | Significant X01–X14 event → outbox → controlled email dispatch → recipient deep link | Correct customer/boutique/Admin recipient set for event, exactly-once intent/retry safety, safe payload and canonical app link. Delivery opens the intended protected entity after login, not generic home or another account. Verify provider delivery, not merely row creation.                                         |

For X15 cover verification submission/decision, request share, quotation, order/payment/refund, design review, appointment/reschedule/reminder, production update/delay, shipment/delivery, support and aftercare. Inventory which events actually have templates/recipients; missing coverage is a gap, not permission to invent sends. Admin does not need every routine customer email by default—define actionable Admin events separately.

## 7. Failure, boundary and recovery pack

Apply this pack to each relevant flow, not only to the happy-path demo:

1. **Identity/access:** signed out, wrong customer, unrelated boutique, assigned/revoked staff, pending/suspended owner, AAL1 versus AAL2 Admin. Test direct page URLs and actual protected mutations/files; hidden buttons alone are not protection.
2. **Duplicate actions:** double submit/accept/pay/share/send; replay webhook or command. One business effect, truthful response.
3. **Concurrency:** two tabs editing a draft/storefront/order; Admin decides while owner edits; two people reserve one slot; two Admins update shipment. Do not silently discard current user input or overwrite newer authoritative state.
4. **Connectivity:** offline/slow request, timeout, provider unavailable, failed storage upload, successful upload followed by failed database save, database error. Clear recovery; no false success or permanently disabled button.
5. **Resume/deep links:** refresh/back/forward, stale links, session expiry mid-form, email opened in another browser, wrong signed-in identity. Return to intended app/entity after authentication, and preserve unsent input where safe.
6. **Uploads/privacy:** wrong MIME/size, corrupt image, orientation, mobile camera photo, foreign path, expired signed URL, referenced-image removal, consent not granted/revoked. No verification document or measurement appears in public catalogue/email.
7. **Money/state:** rupees versus paise, changed price after acceptance, closed/failed/pending capture, duplicate/out-of-order provider events, partial refund. No customer-side assertion is authoritative payment evidence.
8. **Responsive/accessibility:** 360/390px phone, tablet/split view and desktop; touch + keyboard; visible focus, labels, dialogs/Escape/focus restoration, validation scroll/focus, 44px-class touch targets, no accidental horizontal page overflow. Looping slides must not block vertical scrolling or ignore reduced-motion preferences.
9. **Truthful pages:** empty states, missing records and error states distinguish zero data from failed queries. Placeholders/previews must not mimic successful live actions. Status/metrics/sidebar copy must not contradict current backend state.

## 8. Execution order and dependencies

| Run                          | Flows                                                                     | Gate to proceed                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Read-only baseline        | C01 login, C02–C04 browse, S09 reads, A01/A02 reads, A03/A04 empty states | Correct identities, working navigation, database reachable; no real data mutated.                                                  |
| 2. Boutique supply           | S01–S04, X01/X02                                                          | Authorized fixture/documents; approved test boutique and published design; non-public branches proven.                             |
| 3. Demand/quotation          | C05–C07, S05/S06, X03/X04                                                 | Same request/share/quote across apps; one unpaid order; no private-data leakage.                                                   |
| 4. Payment                   | C08, X05                                                                  | Razorpay test credentials/webhook ready; capture/failure/retry proven; no real money.                                              |
| 5. Fulfilment interaction    | X06–X10                                                                   | Paid fixture, design decisions, progress, in-person appointment and chat verified; X09 separately gated on Daily.                  |
| 6. Delivery/aftercare        | X11/X12, S10                                                              | Ready-to-dispatch paid fixture, controlled manual tracking, completion/aftercare.                                                  |
| 7. Exceptions/communications | X13–X15, C09/C11, A05/A06                                                 | Controlled refund/email/contact fixtures; retries and failure branches. Run event-email checks incrementally from Run 2 too.       |
| 8. Regression                | Applicable Section 7 pack + all P0 flows                                  | No unresolved P0; list blocked integration/product decisions explicitly; dependency audit handled or documented as launch blocker. |

Do not use `/preview/*` as proof of these live journeys. They are suitable only for clearly labelled UI demonstrations. Do not replace missing mutations with database writes to manufacture a passed UI flow. Seed fixtures in the controlled environment, then exercise normal app operations.

## 9. Decisions and gaps to resolve before calling testing complete

- Which controlled environment and authorized application/documents will be used? Existing Studio account has no application; existing pending boutique is unsubmitted.
- Which production/order states count as active for chat? Decide whether aftercare needs a separate conversation after completion; verify current SQL/UI against the decision.
- Is location selection a map picker, place autocomplete, or both? Define expected distance/city matching and fixture coordinates before testing nearby boutiques.
- Which garment-specific measurement fields/options are actually implemented? Wizard catalogues and upload entry points need direct UI testing.
- Dedicated logo/cover upload, full theme/layout editor, complete staff management, inventory/SKU stock, automated payouts and dispute arbitration are not assumed features. Made-to-order designs are not stock inventory.
- Approved public profile edits are auto-live today. If name/city changes should require re-verification, that is a product change; do not silently mark the present behavior incorrect without deciding policy.
- Ordinary browser reload versus true live synchronization: define an acceptable refresh/update expectation for orders/chat and test any advertised automatic update mechanism.
- Approval notifications and other critical emails need actual dispatch proof. Razorpay/Daily readiness is not functional proof. Automated courier booking is excluded.
- Invoice is a printable marketplace receipt/order summary; seller tax invoice/legal policy sign-off remain business responsibilities.
- CI dependency audit is currently failing; isolate it from passed database/workflow checks and address it before calling the application production-ready.

## 10. Per-flow test record and completion criteria

Use one record per execution/branch:

```text
Run ID / date / deployment commit:
Flow ID and branch:
App(s), device/viewport and browser profile:
Actors (non-secret identifiers only):
Fixture IDs and starting statuses/versions:
Steps actually performed:
Expected result:
Observed result per app and refresh behavior:
Persistence/file/notification evidence (redacted):
Result: PASS | FAIL | BLOCKED | NOT RUN
Defect ID, severity and exact reproduction:
Provider/external action skipped and why:
Test-data cleanup / restoration / remaining public visibility:
```

A flow passes only when its final business outcome, persisted state and required cross-app handoffs are checked. A page rendering, disabled feature, seeded end state, outbox row, screenshot or successful HTTP status alone is not an end-to-end pass. Record missing UI and unsupported actions as gaps; do not claim them implemented by writing this plan.

First-order launch acceptance requires all applicable P0 happy paths and their access/idempotency/state-boundary checks to pass with controlled data, no unresolved critical/high-impact ordering defects, and explicit evidence for payment capture and manual fulfilment. Non-launch extras can remain in the backlog. This document plans the tests; it does not execute or authorize consequential live approvals/payments/refunds.
