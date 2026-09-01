# Private order messaging checkpoint

## Available

- Customer and Studio `/orders/[id]/messages` routes, linked from order details; completion's Message Boutique action is connected.
- One conversation per accepted order, with plain text messages of 1–2000 characters. No attachments, executable HTML or external notification dispatch.
- Stable command identifiers make identical send retries idempotent; attempts to reuse a reference with different content/sender fail.
- Deterministic sequence ordering, 50-message pages and older/latest navigation. No realtime claims: use Refresh to check for replies.
- An unread incoming-message count and explicit mark-read action through the newest displayed sequence. Cursor never moves backward. Newer unseen messages remain unread. Read state is private to its reader, not a sender-visible receipt.
- Public `/preview/messages` uses fictional text with writes disabled and the existing FADEN typography, palette and responsive header. This is an extension of the current design system, not a claim of exact parity with an exported Stitch messaging screen.

## Database and security

Migration 017 adds `order_messages` and `order_message_reads` to Supabase, the only database. RLS delegates conversation reads to the existing private order policy. Anonymous and unrelated users cannot read; direct authenticated inserts, updates and deletes are revoked. Security-definer RPCs use an empty search path, authenticated participant checks and order row locks.

Both senders require the original boutique owner to remain current, verified and published. The former owner loses access on transfer; the new owner never inherits old conversations. Customers retain their history, but cannot send while the original boutique is unavailable. Cancelled orders retain read-only history. Read marking remains available for authorized readers.

The database serializes sends within each order and limits each sender to 20 new messages per minute per order. Identical retries do not consume a new message. Preview history is capped at 500 messages per order. These are bounded preview safeguards, not a complete production anti-abuse system.

API routes enforce same origin, signed-in access and bounded request size. Production app mode disables preview mutations. The staging database RPCs themselves are available to authenticated authorized participants; staging must remain separate from a future production project. Audit events contain identifiers, never message bodies. No outbox events or provider messages are generated.

Messages are stored in Supabase and accessible to authorized infrastructure administrators; they are not end-to-end encrypted. Do not send credentials, payment details or identity documents.

## Verification

Local result on 1 September 2026: all 44 messaging checks passed, alongside 43 production, 73 appointment, 48 aftercare, 56 fulfilment and 45 design-review checks. All 189 SQL assertions in 15 suites, seven marketplace tests, seven payment unit tests, lint, TypeScript, formatting and seven workspace builds passed. Desktop and 390px mobile samples have no horizontal overflow, and completion-to-messaging navigation works. All three local apps restarted successfully and return healthy responses. Node 20 emits a known Supabase deprecation warning locally; configured CI/Vercel runtime is Node 22.

- `npm run supabase:test`: table/RPC permission regression checks.
- `npm run test:designs`: authenticated HTTP/database fixtures include messaging alongside prior order workflows, with cleanup. Local Supabase only; never run fixture seeding against staging.
- `npm run lint`, `npm run typecheck`, `npm run build` and formatting.
- Public desktop/mobile layout, completion link and deployed anonymous-route checks. Hosted authenticated messaging still needs acceptance testing with real staging accounts.

## Deferred

Cross-order inbox, unread navigation badges, realtime updates, attachments, typing/presence, sender-visible read receipts, delivery notifications, support escalation UI, block/report/moderation, retention/export/deletion policy and broader account/IP abuse controls. Before enabling production, define support ownership and retention, configure monitoring and test hosted identity providers. Live payments remain last.

Next bounded UI phase: the Boutique Studio overview and portfolio, using the original Stitch references and existing catalog permissions.
