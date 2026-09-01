import Link from "next/link";
import { AftercarePanel } from "@faden/ui";
import { notFound } from "next/navigation";
import { isPreviewMutationAllowed } from "@faden/integrations";
import { atelierContext } from "../../../../lib/atelier";
import { AtelierShell } from "../../../../components/atelier-shell";
export default async function Aftercare({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase: db, user } = await atelierContext();
  const result = await db
    .from("customer_orders")
    .select()
    .eq("id", id)
    .eq("boutique_owner_id", user.id)
    .maybeSingle();
  if (result.error?.code === "22P02") notFound();
  if (result.error) throw new Error("Could not load order.");
  if (!result.data) notFound();
  const o = result.data;
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
        owner
        orderId={id}
        items={i.data ?? []}
        events={e.data ?? []}
        eligible={
          !!c.data && o.status !== "cancelled" && isPreviewMutationAllowed()
        }
      />
    </>
  );
  return (
    <AtelierShell active="orders" name={o.boutique_name}>
      {panel}
    </AtelierShell>
  );
}
