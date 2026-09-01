import Link from "next/link";
import { notFound } from "next/navigation";
import { FulfilmentPanel } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
export default function DeliveryPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href="/preview/appointments">← Measurement sessions preview</Link>
        <FulfilmentPanel
          demo
          orderId="sample-order"
          acknowledged
          details={{
            revision: 1,
            address: {
              recipient: "Sample customer",
              phone: "+91••••••••••",
              line1: "Fictional showroom address",
              line2: "Preview only — not a delivery destination",
              city: "Chennai",
              state: "Tamil Nadu",
              postal_code: "600001",
              country: "IN",
            },
          }}
          events={[5, 4, 3, 2, 1].map((stage) => ({
            id: `sample-${stage}`,
            stage,
            sequence: stage,
            note: "Fictional milestone to demonstrate the delivery journey. No parcel was dispatched.",
            created_at: `2026-08-${20 + stage}T09:00:00Z`,
          }))}
        />
      </main>
    </div>
  );
}
