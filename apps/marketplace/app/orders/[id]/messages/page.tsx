import Link from "next/link";
import { OrderMessages } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
export default async function Messages({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const viewerId = user!.id;
  const raw = (await searchParams).before;
  const before =
    raw && /^\d{1,3}$/.test(raw) && Number(raw) > 0
      ? Math.min(Number(raw), 501)
      : 501;
  const [history, read, boutique] = await Promise.all([
    db
      .from("order_messages")
      .select()
      .eq("order_id", id)
      .lt("sequence", before)
      .order("sequence", { ascending: false })
      .limit(51),
    db
      .from("order_message_reads")
      .select("last_sequence")
      .eq("order_id", id)
      .eq("reader_id", viewerId)
      .maybeSingle(),
    db
      .from("boutiques")
      .select("id")
      .eq("id", o.boutique_id)
      .eq("owner_id", o.boutique_owner_id)
      .eq("status", "verified")
      .eq("is_published", true)
      .maybeSingle(),
  ]);
  if (history.error || read.error || boutique.error)
    throw new Error("Could not load conversation.");
  const unread = await db
    .from("order_messages")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id)
    .neq("sender_id", viewerId)
    .gt("sequence", read.data?.last_sequence ?? 0);
  if (unread.error) throw new Error("Could not load unread count.");
  const messages = (history.data ?? []).slice(0, 50).reverse();
  const panel = (
    <>
      <Link href={`/orders/${id}`}>← Order details</Link>
      <OrderMessages
        orderId={id}
        viewerId={viewerId}
        boutiqueName={o.boutique_name}
        messages={messages}
        unread={unread.count ?? 0}
        readThrough={messages.at(-1)?.sequence ?? 0}
        eligible={
          o.status !== "cancelled" &&
          !!boutique.data &&
          process.env.NEXT_PUBLIC_APP_ENV !== "production"
        }
      />
      <nav className="chat-pagination" aria-label="Message history">
        {history.data.length > 50 && (
          <Link href={`?before=${messages[0].sequence}`}>← Older messages</Link>
        )}
        {before < 501 && (
          <Link href={`/orders/${id}/messages`}>Latest messages →</Link>
        )}
      </nav>
    </>
  );
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">{panel}</main>
    </div>
  );
}
