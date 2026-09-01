# Studio overview and portfolio checkpoint

## Design and routes

The desktop overview follows Stitch `25a57628`; responsive layout draws on mobile `31b92f17`. The portfolio follows `f1e93535`, including its editorial feature/secondary cards, Syne/Karla typography, restrained color palette and original high-resolution images. Exact sample labels, fictional money, unsupported navigation and reminder actions are not presented as live features. Final visual acceptance by the owner is still needed; this is not a pixel-perfect parity claim.

- Private Studio `/`: counts for active shared invitations, sent offers, non-cancelled accepted orders and upcoming/in-progress measurement rehearsals. Attention items identify draft offers and ended sessions needing outcomes. Recent requests are limited to five, and today's confirmed sessions to five, using India Standard Time.
- Counts span the signed-in user's verified, published, owned boutiques and retain existing order/request/session RLS. Staff-only catalog membership does not grant order-dashboard access. No private unshared drafts are queried.
- Payments due remains unavailable. Sent offers are a status count, not an assertion that all offers remain unexpired; accepted orders may include delivered rehearsals. Full request and appointment lists remain linked.
- Private `/portfolio`: explicit boutique selector from existing catalog membership; server-side title search, literal wildcard handling, category/status filters, 24-design pages and clear empty states.
- Public `/preview/overview` and `/preview/portfolio`: fictional samples, with catalog mutations disabled. Preview portfolio filters remain interactive. Other workspace links lead to sign-in, not fabricated private records.

## Portfolio editing

Create drafts and edit title, description, INR starting price (paise precision), occasions, editorial image and lead-time range. Choose Draft, Published or Archived. Publishing requires a positive price, an approved image URL, explicit confirmation and a verified public boutique. Archiving retains the design without deleting it from storage.

New creations use a stable `design-<command UUID>` slug as a retry reference; Supabase generates the protected database row ID. An identical retry returns the existing row. Edits use the current `updated_at` value as a conditional write; stale and concurrent overwrites return a reload message. The editor does not overwrite gallery, materials, techniques or unrelated fields.

The API uses the signed-in Supabase client, checks same-origin requests and catalog membership, bounds inputs, rejects arbitrary image hosts and returns generic storage failures. Accepted images are existing Stitch sources or HTTPS public-object URLs from this Supabase project's storage. Existing Stitch images resolve to the Marketplace's full-resolution static assets, avoiding the prior external low-resolution fallback. No uploads, external fetches from the server or bucket changes occur.

These are genuine staging catalog edits, not a simulated rehearsal: publishing can make a piece visible in the staging Marketplace. Never use real sensitive information in public media or descriptions.

## Database boundary

No migration or permission widening was needed. Existing catalog RLS, column grants and Supabase-generated IDs remain intact. Catalog permissions remain membership-based, separate from original-owner-only private order workflows. The API adds application-level validation and concurrency protection; existing authorized direct database access is not replaced by a new restrictive RPC. Database-level content validation, moderation, auditing, abuse limits, upload policies and membership lifecycle review remain pre-launch work. Do not describe this phase as production-security completion.

## Verification

Local checkpoint on 1 September 2026: all 38 Studio checks, 189 SQL assertions across 15 suites, 309 existing order-workflow checks, lint, TypeScript, formatting and all seven workspace builds passed. Marketplace/Admin builds were cache hits; Studio was freshly built. Local health endpoints on 3000, 3001 and 3002 return 200 after automatic restart.

`npm run test:studio` provides 38 local fixture checks for anonymous/cross-origin denial, cross-boutique isolation, price/image/lead-time validation, publishing confirmation, draft/archive visibility, retries, concurrent edits, filters, pagination and dashboard privacy. Fixtures are isolated to a temporary boutique and removed afterward. The command is included in the existing GitHub Actions workflow; this does not imply a remote CI run has occurred.

The existing order workflow regression, SQL tests, lint, typecheck, formatting and builds remain release gates. Browser checks cover desktop previews, working category/search/empty-state flows, mobile menu navigation and verified 390px geometry. The viewport override applied with a delay; only screenshots with confirmed browser dimensions count as mobile evidence.

Hosted authenticated acceptance testing with staging accounts remains pending. Do not import local fixture accounts into staging. Local Node 20 emits the existing Supabase deprecation warning; CI/Vercel target Node 22.

## Next

Portfolio image uploads and real collection management. After that: remaining Studio analytics/support/navigation and Admin screens, provider configuration, hosted authentication acceptance and live payments last. No live payment, courier, call, reminder or email/SMS action is enabled by this phase.
