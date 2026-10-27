# Early-launch boutique approval without official documents

## Policy

Owners still register a boutique with an account, name, handle, city and introduction. Registration remains private and notifies Admin. For early launch, Admin may approve marketplace participation without collecting official documents. Approval is not a claim that PAN, registration or address documents were verified.

Only an authenticated **AAL2 Admin** can use the waiver action, for one explicitly selected pending/draft boutique, with a reason and confirmation. It cannot bypass suspension or rejection, cannot create a boutique, and does not approve every registration automatically. It records `boutique.approved_without_documents` in the audit log and queues an owner notification. Repeating approval does not duplicate that audit/notification or republish a subsequently hidden boutique.

The existing official-document submission/approval workflow remains strict and available separately. No invented PAN, fake official documents or fabricated verification submission is needed for the waiver route. Database status `verified` is retained for compatibility with existing order/catalogue gates; customer badges say **FADEN approved**, not document-verified.

## Use

1. Owner registers at `https://studio.faden.in/onboarding`, completes Public storefront and account contact details.
2. Admin opens `https://admin.faden.in/boutiques`, reviews that owner/profile and selects **Approve without documents**.
3. Admin enters a reason, explicitly confirms that official documents were not verified, then submits.
4. Customer discovery and the boutique page become available; the owner can manage portfolio, requests, quotations and orders.

Studio's approval page explains that documents are optional for early-launch Admin review. The official-document form is a separate expandable option. After document-free approval, Studio shows the approved workspace rather than asking the owner for a PAN/application again.

## Implementation

- Migration: `supabase/migrations/202610270045_admin_document_free_approval.sql`.
- Mutation: Admin `/api/boutiques`, action `approve_without_documents`.
- Database authority: `admin_approve_boutique_without_documents(uuid,text,boolean)`; same-origin, session and AAL2 guards also remain at HTTP level.
- Notification: dedicated owner recipient lookup from the boutique record, not the nonexistent document submission. Notification queuing is not proof of SMTP delivery.
- SQL regressions: `supabase/tests/027_document_free_approval.sql`.
- Full isolated journey: `npm run test:complete-order -- --without-documents`; the standard document journey still runs too.

## Live inspection and rollout

Validation: [CI run 40484863702](https://github.com/fadenthreads/FADEN-webApp-new/actions/runs/40484863702), database job `122124010660`, commit `1009cc8`, passed **493 SQL/RLS tests in 27 files**, the **31-check standard-document journey** and **30-check document-free journey**, all existing integration suites and all three builds/container jobs. The document-free run created no verification submission and proceeded through quotation, simulated test capture, production, manual delivery statuses and review on order `912ea43d-1b88-47fa-892f-437925834142` in CI only. Overall CI remains non-green solely because of the previously reported Next/Zod/Nodemailer dependency audit. Local lint/typecheck/unit checks passed. Email queuing/recipient routing exists; actual SMTP delivery was not tested.

27 October 2026: Arc's authenticated Admin directory and the deployed confirmation dialog were inspected. The dialog was cancelled, not submitted. Per the user's explicit direction, **dcedf remains pending**. All 36 anonymous live smoke checks passed, including its customer page returning 404.

Hosted migration history was read through Supabase's dashboard and ends at **042**. **043–045 have not been applied to hosted Supabase during this change.** The deployed approval button cannot successfully approve until 045 is installed; a GitHub push/Vercel deployment does not install SQL. Apply 043/044 first to preserve migration order and include the previously tested registration/address fixes, then 045, recording the actual versions in migration history.

No production boutique was approved, no real money/courier was used, and no real verification documents were uploaded. Live database policy activation requires confirmation before executing the hosted update. Subsequent manual approval is a separate per-boutique decision; installing these functions does not approve dcedf or any other boutique.

If document-free onboarding is later discontinued, remove its UI/API action and revoke authenticated execution of the waiver RPC. Do not revoke ordinary document-review functions or rewrite historical audit records.
