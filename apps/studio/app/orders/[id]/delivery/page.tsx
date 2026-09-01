import Link from "next/link";
import { notFound } from "next/navigation";
import { FulfilmentPanel } from "@faden/ui";
import { isPreviewMutationAllowed } from "@faden/integrations";
import { atelierContext } from "../../../../lib/atelier";
import { AtelierShell } from "../../../../components/atelier-shell";
export default async function Delivery({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase: db, user } = await atelierContext();
  const o = await db
    .from("customer_orders")
    .select()
    .eq("id", id)
    .eq("boutique_owner_id", user.id)
    .maybeSingle();
  if (o.error?.code === "22P02") notFound();
  if (o.error) throw new Error("Could not load order.");
  if (!o.data) notFound();
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
    <AtelierShell active="orders" name={o.data.boutique_name}>
      <Link href={`/orders/${id}`}>← Order details</Link>
      <FulfilmentPanel
        owner
        orderId={id}
        details={a.data}
        events={e.data ?? []}
        acknowledged={!!c.data}
        readOnly={o.data.status === "cancelled" || !isPreviewMutationAllowed()}
      />
    </AtelierShell>
  );
}
