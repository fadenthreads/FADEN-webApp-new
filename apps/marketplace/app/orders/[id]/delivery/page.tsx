import Link from "next/link";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
import { customerOrder } from "../../../../lib/orders";
export default async function Delivery({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Resolve ownership first so unrelated users receive the normal private-order
  // 404 instead of turning the RPC's audience rejection into a server error.
  await customerOrder(id);
  const db = await getSupabaseServerClient();
  const { data, error } = await db.rpc("read_order_manual_shipment", {
    p_order_id: id,
  });
  if (error) throw new Error("Could not load delivery tracking.");
  const tracking = data as {
    shipment: {
      carrier_name: string;
      tracking_number: string;
      tracking_url: string | null;
      status: string;
    } | null;
    timeline: Array<{ status: string; created_at: string }>;
  };
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href={`/orders/${id}`}>← Order details</Link>
        <span className="offer-kicker">FADEN delivery</span>
        <h1>Shipment tracking</h1>
        {!tracking.shipment ? (
          <div className="offer-panel">
            <h2>Courier arrangement pending</h2>
            <p>
              FADEN is arranging your courier. Tracking will appear here once it
              is confirmed.
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
            <ol className="journey-story">
              {tracking.timeline.map((event, index) => (
                <li key={`${event.status}-${event.created_at}-${index}`}>
                  <strong>{event.status.replaceAll("_", " ")}</strong> ·{" "}
                  {new Date(event.created_at).toLocaleString("en-IN")}
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
