import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentPanel } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
export default function AppointmentPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href="/preview/production">← Production preview</Link>
        <AppointmentPanel
          demo
          appointments={[
            {
              id: "example-completed",
              order_id: "sample-order",
              starts_at: "2026-08-25T04:30:00Z",
              ends_at: "2026-08-25T05:00:00Z",
              kind: "video",
              location: "",
              state: "booked",
              status: "completed",
              outcome_at: "2026-08-25T05:05:00Z",
              follow_up_of: "example-no-show",
            },
            {
              id: "example-no-show",
              order_id: "sample-order",
              starts_at: "2026-08-20T04:30:00Z",
              ends_at: "2026-08-20T05:00:00Z",
              kind: "boutique",
              location:
                "Atelier Maison · fictional showroom address for preview only.",
              state: "booked",
              status: "no_show",
              outcome_at: "2026-08-20T05:05:00Z",
            },
          ]}
          slots={[
            {
              id: "sample-video",
              starts_at: "2026-09-05T04:30:00Z",
              ends_at: "2026-09-05T05:00:00Z",
              kind: "video",
              location: "",
              state: "open",
            },
            {
              id: "sample-boutique",
              starts_at: "2026-09-05T08:30:00Z",
              ends_at: "2026-09-05T09:30:00Z",
              kind: "boutique",
              location:
                "Atelier Maison · fictional showroom address for preview only.",
              state: "open",
            },
          ]}
        />
      </main>
    </div>
  );
}
