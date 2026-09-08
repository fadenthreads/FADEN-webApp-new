import Link from "next/link";
import { notFound } from "next/navigation";
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
  const { data, error } = await db.rpc("read_order_manual_shipment", {
    p_order_id: id,
  });
  if (error) throw new Error("Could not load delivery history.");
  const tracking = data as {
    shipment: {
      carrier_name: string;
      tracking_number: string;
      tracking_url: string | null;
      status: string;
      shipped_at: string | null;
      delivered_at: string | null;
    } | null;
    timeline: Array<{ status: string; created_at: string }>;
  };
  return (
    <AtelierShell active="orders" name={o.data.boutique_name}>
      <Link href={`/orders/${id}`}>← Order details</Link>
      <span className="offer-kicker">Admin-managed delivery</span>
      <h1>Shipment tracking</h1>
      {!tracking.shipment ? (
        <div className="offer-panel">
          <h2>Courier arrangement pending</h2>
          <p>
            FADEN Admin will arrange delivery and add tracking once the courier
            is confirmed. Your team cannot create courier events here.
          </p>
        </div>
      ) : (
        <div className="offer-panel">
          <h2>{tracking.shipment.status.replaceAll("_", " ")}</h2>
          <p>
            {tracking.shipment.carrier_name} ·{" "}
            {tracking.shipment.tracking_number}
          </p>
          {tracking.shipment.tracking_url && (
            <a
              href={tracking.shipment.tracking_url}
              target="_blank"
              rel="noreferrer"
            >
              Open carrier tracking →
            </a>
          )}
          <ol className="atelier-timeline">
            {tracking.timeline.map((event, index) => (
              <li key={`${event.status}-${event.created_at}-${index}`}>
                <strong>{event.status.replaceAll("_", " ")}</strong>
                <time>
                  {new Date(event.created_at).toLocaleString("en-IN")}
                </time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </AtelierShell>
  );
}
