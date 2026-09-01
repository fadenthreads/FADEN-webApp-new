import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignReviewView, reviewLabel } from "@faden/ui";
import { atelierContext } from "../../../../lib/atelier";
import { AtelierShell } from "../../../../components/atelier-shell";
import { DesignEditor } from "../../../../components/design-editor";
export default async function OrderDesign({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, boutiques } = await atelierContext();
  const { data: order, error } = await supabase
    .from("customer_orders")
    .select()
    .eq("id", id)
    .eq("boutique_owner_id", user.id)
    .maybeSingle();
  if (error?.code === "22P02") notFound();
  if (error) throw new Error("Could not load your order.");
  if (!order || !boutiques.some((b) => b.id === order.boutique_id)) notFound();
  const { data, error: reviewError } = await supabase
    .from("order_design_reviews")
    .select()
    .eq("order_id", id)
    .order("revision", { ascending: false })
    .limit(20);
  if (reviewError) throw new Error("Could not load design history.");
  const reviews = await Promise.all(
    (data ?? []).map(async (r) => ({
      ...r,
      sketchUrl: (
        await supabase.storage
          .from("order-designs")
          .createSignedUrl(r.sketch_path, 300)
      ).data?.signedUrl,
    })),
  );
  const latest = reviews[0];
  const canPublish =
    order.status !== "cancelled" &&
    (!latest || latest.status === "changes_requested") &&
    (latest?.revision ?? 0) < 20;
  return (
    <AtelierShell active="orders" name={order.boutique_name}>
      <Link href={`/orders/${id}`}>← Order details</Link>
      <h1>Design studio</h1>
      {canPublish && (
        <DesignEditor
          key={latest?.revision ?? 0}
          orderId={id}
          revision={latest?.revision ?? 0}
        />
      )}
      <DesignReviewView
        boutique={order.boutique_name}
        reviews={reviews}
        actions={
          <p>
            {order.status === "cancelled"
              ? "Cancelled order — read-only history."
              : latest
                ? reviewLabel(latest.status)
                : "No design shared yet."}{" "}
            Only the customer can record a decision. Approved versions are
            locked; commercial amendments are not enabled.
          </p>
        }
      />
    </AtelierShell>
  );
}
