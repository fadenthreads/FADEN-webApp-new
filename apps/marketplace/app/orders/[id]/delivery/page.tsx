import Link from "next/link";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
import { customerOrder } from "../../../../lib/orders";
import { deliveryStatusLabel, fadenContact } from "@faden/ui";
import { OrderUpdateRefresh } from "../../../../components/order-update-refresh";
export default async function Delivery({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Resolve ownership first so unrelated users receive the normal private-order
  // 404 instead of turning the RPC's audience rejection into a server error.
  const order = await customerOrder(id);
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
        <h1>Your delivery updates</h1>
        <p>Order reference: {id}</p>
        <p>
          FADEN arranges your delivery directly and keeps the tracking details
          updated here.
        </p>
        <OrderUpdateRefresh />
        {!tracking.shipment ? (
          <div className="offer-panel">
            <h2>
              {order.status === "cancelled"
                ? "Order cancelled"
                : "Delivery not dispatched yet"}
            </h2>
            <p>
              {order.status === "cancelled"
                ? "This order has been cancelled. Contact us if you need help."
                : "Once payment is confirmed and your outfit is ready, our team will arrange a courier. Carrier details and tracking will appear here after booking."}
            </p>
          </div>
        ) : (
          <div className="offer-panel">
            <h2>{deliveryStatusLabel(tracking.shipment.status)}</h2>
            {tracking.shipment.status === "exception" && (
              <p>
                Our team is checking a delivery issue with the courier. Please
                contact us if you need assistance.
              </p>
            )}
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
                  <strong>{deliveryStatusLabel(event.status)}</strong> ·{" "}
                  <time dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </time>
                </li>
              ))}
            </ol>
          </div>
        )}
        <section className="offer-panel">
          <h2>Need help with delivery?</h2>
          <p>{fadenContact.name} · FADEN customer care</p>
          <p>
            <a href={fadenContact.phoneHref}>{fadenContact.phone}</a> ·{" "}
            <a
              href={`mailto:${fadenContact.email}?subject=${encodeURIComponent(`Delivery enquiry: ${id}`)}`}
            >
              {fadenContact.email}
            </a>
          </p>
          <Link href={`/orders/${id}/support`}>
            Send an order support request →
          </Link>
        </section>
      </main>
    </div>
  );
}
