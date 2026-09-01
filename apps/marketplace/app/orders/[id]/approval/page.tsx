import Link from "next/link";
import { DesignReviewView, reviewLabel } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { DesignDecision } from "../../../../components/design-decision";
export default async function Approval({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await customerOrder(id);
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_design_reviews")
    .select()
    .eq("order_id", id)
    .order("revision", { ascending: false })
    .limit(20);
  if (error)
    throw new Error("Could not load design versions. Please try again.");
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
  return (
    <main className="market-page">
      <nav className="design-review-nav" aria-label="Order navigation">
        <Link href={`/orders/${id}`}>← Order details</Link>
        <Link href={`/journey/${id}`}>Your outfit journey →</Link>
      </nav>
      <DesignReviewView
        boutique={order.boutique_name}
        reviews={reviews}
        actions={
          order.status === "cancelled" ? (
            <p>This order was cancelled. Design history is read-only.</p>
          ) : latest?.status === "pending" ? (
            <DesignDecision key={latest.id} reviewId={latest.id} />
          ) : (
            <p>
              {latest ? reviewLabel(latest.status) : "Awaiting a proposal."}{" "}
              Your decision is preserved in the history below.
            </p>
          )
        }
      />
    </main>
  );
}
