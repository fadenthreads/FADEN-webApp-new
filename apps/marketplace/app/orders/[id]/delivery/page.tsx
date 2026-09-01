import Link from "next/link";
import { FulfilmentPanel } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
export default async function Delivery({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const [a, e, c] = await Promise.all([
    db.from("order_delivery_details").select().eq("order_id", id).maybeSingle(),
    db
      .from("order_shipment_events")
      .select()
      .eq("order_id", id)
      .order("sequence", { ascending: false })
      .limit(30),
    db
      .from("order_delivery_confirmations")
      .select()
      .eq("order_id", id)
      .maybeSingle(),
  ]);
  if (a.error || e.error || c.error)
    throw new Error("Could not load delivery history.");
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href={`/orders/${id}`}>← Order details</Link>
        <FulfilmentPanel
          orderId={id}
          details={a.data}
          events={e.data ?? []}
          acknowledged={!!c.data}
          readOnly={
            o.status === "cancelled" ||
            process.env.NEXT_PUBLIC_APP_ENV === "production"
          }
        />
      </main>
    </div>
  );
}
