import Link from "next/link";
import { OrderMessages } from "@faden/ui";
import { MarketplaceHeader } from "../../../components/marketplace-header";
export default function Preview() {
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link href="/preview/complete">← Completion preview</Link>
        <OrderMessages
          demo
          eligible={false}
          orderId="preview"
          viewerId="customer"
          boutiqueName="Maison Faden · fictional atelier"
          unread={1}
          readThrough={3}
          messages={[
            {
              id: "1",
              sequence: 1,
              sender_id: "customer",
              body: "I love the terracotta fabric. Could we keep the sleeve finish soft and minimal?",
              created_at: "2026-09-01T09:00:00Z",
            },
            {
              id: "2",
              sequence: 2,
              sender_id: "boutique",
              body: "Absolutely. A clean, softly tailored cuff would complement the silhouette beautifully. We can discuss the final length during your fitting.",
              created_at: "2026-09-01T09:10:00Z",
            },
            {
              id: "3",
              sequence: 3,
              sender_id: "boutique",
              body: "When you’re ready, share your thoughts here. Your design approvals and measurement bookings stay in their dedicated order screens.",
              created_at: "2026-09-01T09:12:00Z",
            },
          ]}
        />
      </main>
    </div>
  );
}
