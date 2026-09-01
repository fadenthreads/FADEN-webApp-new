import Link from "next/link";
import { AftercarePanel } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
export default async function Aftercare({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const [i, c] = await Promise.all([
    db
      .from("order_aftercare_items")
      .select()
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(11),
    db
      .from("order_delivery_confirmations")
      .select("order_id")
      .eq("order_id", id)
      .maybeSingle(),
  ]);
  if (i.error || c.error) throw new Error("Could not load aftercare.");
  const e = i.data?.length
    ? await db
        .from("order_aftercare_events")
        .select()
        .in(
          "item_id",
          i.data.map((x) => x.id),
        )
        .order("version")
        .limit(100)
    : { data: [], error: null };
  if (e.error) throw new Error("Could not load response history.");
  const panel = (
    <>
      <Link href={`/orders/${id}`}>← Order details</Link>
      <AftercarePanel
        orderId={id}
        items={i.data ?? []}
        events={e.data ?? []}
        eligible={
          !!c.data &&
          o.status !== "cancelled" &&
          process.env.NEXT_PUBLIC_APP_ENV !== "production"
        }
      />
    </>
  );
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">{panel}</main>
    </div>
  );
}
