import Link from "next/link";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { OrderCompletion } from "../../../../components/order-completion";
export default async function Complete({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const c = await db
    .from("order_delivery_confirmations")
    .select()
    .eq("order_id", id)
    .maybeSingle();
  if (c.error) throw new Error("Could not load completion status.");
  if (!c.data || o.status === "cancelled")
    return (
      <main className="offer-main">
        <h1>Completion preview is not ready.</h1>
        <p>
          {o.status === "cancelled"
            ? "This order is cancelled."
            : "Complete the delivery rehearsal and customer confirmation first."}{" "}
          No real order is marked complete.
        </p>
        <Link href={`/orders/${id}/delivery`}>Back to delivery rehearsal</Link>
      </main>
    );
  const p = await db
    .from("order_production_updates")
    .select("photo_path")
    .eq("order_id", id)
    .not("photo_path", "is", null)
    .order("sequence", { ascending: false })
    .limit(1);
  if (p.error) throw new Error("Could not load your outfit photo.");
  const path = p.data?.[0]?.photo_path;
  const imageUrl = path
    ? (await db.storage.from("order-progress").createSignedUrl(path, 300)).data
        ?.signedUrl
    : undefined;
  return (
    <OrderCompletion
      imageUrl={imageUrl}
      backHref={`/orders/${id}/delivery`}
      aftercareHref={`/orders/${id}/aftercare`}
      messagesHref={`/orders/${id}/messages`}
    />
  );
}
