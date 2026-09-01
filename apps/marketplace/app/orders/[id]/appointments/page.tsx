import Link from "next/link";
import { AppointmentPanel } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
export default async function OrderAppointments({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const supabase = await getSupabaseServerClient();
  const { data: appointments, error } = await supabase
    .from("measurement_appointments")
    .select()
    .eq("order_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: slots, error: slotError } =
    o.status === "cancelled"
      ? { data: [], error: null }
      : await supabase
          .from("appointment_slots")
          .select()
          .eq("boutique_id", o.boutique_id)
          .eq("owner_id", o.boutique_owner_id)
          .eq("state", "open")
          .gte("starts_at", new Date(Date.now() + 5 * 60000).toISOString())
          .order("starts_at")
          .limit(100);
  if (error || slotError)
    throw new Error("Could not load measurement sessions.");
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href={`/orders/${id}`}>← Order details</Link>
        {o.status === "cancelled" && (
          <p className="design-notice">
            This order is cancelled. Future reservations have been cancelled;
            history remains available.
          </p>
        )}
        <AppointmentPanel
          orderId={id}
          slots={slots ?? []}
          appointments={(appointments ?? []).map((a) => ({
            ...a,
            state: "booked",
          }))}
        />
      </main>
    </div>
  );
}
