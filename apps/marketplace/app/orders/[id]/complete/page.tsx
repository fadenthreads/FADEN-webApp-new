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
  const { data: tracking, error: trackingError } = await db.rpc(
    "read_order_manual_shipment",
    { p_order_id: id },
  );
  if (trackingError) throw new Error("Could not load completion status.");
  if (
    (tracking as { shipment?: { status?: string } } | null)?.shipment
      ?.status !== "delivered" ||
    o.status === "cancelled"
  )
    return (
      <main className="offer-main">
        <h1>Completion is not ready.</h1>
        <p>
          {o.status === "cancelled"
            ? "This order is cancelled."
            : "Delivery must be confirmed before completion."}
        </p>
        <Link href={`/orders/${id}/delivery`}>Back to delivery tracking</Link>
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
