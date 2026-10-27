# Studio, Admin and customer workflow audit

Reviewed: 26 October 2026. Scope: `studio.faden.in`, the linked Admin verification workflow, and customer boutique discovery/profile rendering.

## Verification boundary

The live browser was signed out. Studio correctly redirected to sign-in. No real boutique application was submitted or approved, no real customer order was changed, and no email delivery was exercised. Findings below distinguish implementation/source checks from a signed-in end-to-end test.

## Registration and approval

1. A customer account can register a single boutique with a name, unique public handle, city and introduction. The resulting owner workspace is private/pending verification.
2. The owner continues to Verification: legal business details, registered address, representative and contact information.
3. Required documents are business registration, PAN and registered-address proof. GST certificate is conditional; representative ID and other supporting documents are also supported. Images/PDFs use private storage, with image/PDF size limits.
4. Saving a draft is not submitting it. The owner must submit the completed application for review.
5. Admin lists boutiques and opens their verification record. Admin document downloads/review decisions require the existing Admin AAL2 checks. Admin can approve, request corrections, or reject; owners see decision feedback.
6. Approval sets the boutique to verified and the existing approval trigger publishes it. Rejected/suspended/private boutiques remain excluded from public discovery. Later Admin hiding/suspension still overrides public visibility.
7. Published designs require a verified, public boutique. Draft/archive status controls individual item visibility; no separate design-approval queue exists.

### Blocking problems found and corrected in this change

- Boutique registration did not initialize `boutique_profiles`, while discovery uses an inner join to that table and the storefront editor required it. Migration `202610260042_studio_storefront_foundation.sql` initializes new profiles and backfills missing ones without overwriting existing content.
- The old storefront route attempted direct writes to tables without the necessary authenticated update grants. It also performed identity and profile writes separately, risking a partial save. A narrow owner-only, optimistic-concurrency RPC now updates both in a single transaction, without allowing approval/publication changes.
- Pending owners were led back into the onboarding/overview loop rather than to verification. Registration now continues to verification; Overview shows a setup checklist.
- The verification success text incorrectly said approval did not publish. It now describes the actual gate and later Admin overrides.
- Account settings and Verification were not consistently accessible across Studio shells. Both navigation layouts now expose them.
- A mobile customer-page cover was hardcoded for one seeded boutique, so its actual configured cover was ignored. Customer rendering now uses the configured image.

## Owner controls and approval rules

| Control                                                                                   | Where               | Admin approval / visibility                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Personal display name and contact phone                                                   | Account & settings  | No approval; does not modify verified legal identity or authentication email                                            |
| Sign-in email                                                                             | Account (read-only) | Not self-service in this change; use support/authentication flow                                                        |
| Public boutique name, city, introduction, story                                           | Public storefront   | Can prepare while pending; after verification saves become public without repeat approval                               |
| Services, specialties, experience, response time, availability, starting price, lead time | Public storefront   | Same public gate; these are preferences, not guaranteed bookings/quotes                                                 |
| Public cover                                                                              | Public storefront   | Choose an owned, published portfolio image; pending boutiques remain private; private verification files cannot be used |
| Design images, descriptions, price, categories, lead time, publish/archive                | Portfolio           | Owner/assigned member permissions; publishing requires verified/public boutique                                         |
| Legal details and documents                                                               | Verification        | Editable draft/corrections; submitted/approved snapshots are locked; Admin review required                              |
| Approved legal identity, ownership, public handle, bank/payout details                    | Support-assisted    | No new self-service flow was added                                                                                      |
| Application approval, suspension and platform visibility                                  | Admin               | Not owner-controlled                                                                                                    |

The Account page includes these rules. Storefront editing provides a local preview and a link to the live customer page only when public. Draft/private state is explicitly labelled. Cover files cannot be removed through the shared upload cleanup API while still referenced as a storefront cover.

## Cross-site reflection

- Customer discovery/profile/homepage read the same `boutiques`, `boutique_profiles`, and `designs` records. They filter verification/publication state; no separate copied catalogue needs syncing.
- Customer pages use dynamic server rendering. Saved values appear on the next page request/refresh; there is no promise of instant websocket updates in an already-open browser tab.
- Admin boutique lists read current name/city/status/owner information. The verification page now also shows current customer-facing content separately from the submitted legal snapshot, with a live-customer-page link when public.
- Verification documents stay private. Measurement/request sharing and order/chat permissions are unchanged by this work.
- Approval notification/outbox code exists; actual delivery depends on the configured dispatcher. This audit did not send test emails.

## Still missing or intentionally limited

- A complete signed-in test with a fresh owner, Admin decision, customer discovery, profile edit and design publication must still be performed. The public browser session cannot establish that proof.
- Dedicated logo upload, custom page layouts/themes and a separate story-image editor are not present. Cover selection uses published portfolio images; publishing an image as a design is not a dedicated brand-asset library.
- Staff invitation/permission management is not a complete self-service workflow. Assigned staff can use their portfolio memberships; order operations and storefront/business management remain owner-only.
- Approved legal/bank/ownership changes, account deletion and sign-in email changes require support; no automated re-verification/change-request workflow was introduced.
- No per-profile-edit Admin approval queue or detailed storefront edit-history UI exists. Everyday approved-boutique profile edits are currently auto-live.
- Designs are a made-to-order catalogue, not a quantity-based SKU/stock inventory system.
- This work does not certify live payment, payout, courier, video-call, or email-provider configuration. Manual shipping remains the launch approach.

## Validation

Run `npm run test:studio-storefront` for visibility/approval-rule tests and the existing upload reference checks. Run `node scripts/test-studio-storefront.mjs --database` for isolated native-PostgreSQL checks (no Docker or hosted writes): profile initialization/backfill, pending/private state, atomic save/rollback, stale-write rejection, foreign-owner/cover rejection and customer visibility after the verification gate.

Hosted database confirmation (27 October 2026): the Dashboard verification result supplied by the owner shows migration `202610260042` recorded, `save_boutique_storefront` present, and zero boutiques missing profile rows. Do not rerun the migration manually. This database confirmation does not establish that a real signed-in submission/approval flow has been tested.
