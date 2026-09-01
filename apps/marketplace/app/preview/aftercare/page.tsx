import Link from "next/link";
import { notFound } from "next/navigation";
import { AftercarePanel } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
export default function Preview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href="/preview/complete">← Completion preview</Link>
        <AftercarePanel
          demo
          eligible
          orderId="sample-order"
          items={[
            {
              id: "sample-review",
              kind: "review",
              rating: 5,
              body: "Fictional feedback: the silhouette and finishing matched my design brief.",
              status: "submitted",
              version: 1,
              created_at: "2026-08-26T09:00:00Z",
            },
            {
              id: "sample-alteration",
              kind: "alteration",
              rating: null,
              body: "Fictional request: please review the sleeve length at a follow-up fitting.",
              status: "ready",
              version: 3,
              created_at: "2026-08-26T09:10:00Z",
            },
          ]}
          events={[
            {
              id: "sample-response-1",
              item_id: "sample-alteration",
              version: 2,
              status: "accepted",
              note: "Sample boutique response: sleeve adjustment accepted for rehearsal only.",
              created_at: "2026-08-27T09:00:00Z",
            },
            {
              id: "sample-response-2",
              item_id: "sample-alteration",
              version: 3,
              status: "ready",
              note: "Sample boutique response: ready for customer confirmation. No real work was performed.",
              created_at: "2026-08-28T09:00:00Z",
            },
          ]}
        />
      </main>
    </div>
  );
}
