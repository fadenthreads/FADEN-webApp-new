import Link from "next/link";
import { ProductionBoard, briefText } from "@faden/ui";
import { atelierContext } from "../../lib/atelier";
import { AtelierShell } from "../../components/atelier-shell";
export default async function Production({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, user } = await atelierContext();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const offset = (Math.floor(page) - 1) * 30;
  const { data: orders, error } = await supabase
    .from("customer_orders")
    .select("id,quote,boutique_name")
    .eq("boutique_owner_id", user.id)
    .neq("status", "cancelled")
    .order("accepted_at", { ascending: false })
    .order("id")
    .range(offset, offset + 30);
  if (error) throw new Error("Could not load your production board.");
  const rows = (orders ?? []).slice(0, 30);
  const { data: updates, error: progressError } = rows.length
    ? await supabase
        .from("order_production_summary")
        .select()
        .in(
          "order_id",
          rows.map((o) => o.id),
        )
    : { data: [], error: null };
  if (progressError) throw new Error("Could not load production progress.");
  return (
    <AtelierShell active="production">
      <ProductionBoard
        orders={rows.map((o) => {
          const p = updates?.find((p) => p.order_id === o.id);
          return {
            id: o.id,
            title: briefText(o.quote, "title"),
            boutique: o.boutique_name,
            stage: p?.stage ?? 0,
            updatedAt: p?.created_at ?? undefined,
            href: `/orders/${o.id}/production`,
          };
        })}
      />
      <nav className="offer-actions" aria-label="Production pages">
        {page > 1 && (
          <Link href={`/production?page=${Math.floor(page) - 1}`}>
            ← Previous page
          </Link>
        )}
        {(orders?.length ?? 0) > 30 && (
          <Link href={`/production?page=${Math.floor(page) + 1}`}>
            Next page →
          </Link>
        )}
      </nav>
    </AtelierShell>
  );
}
