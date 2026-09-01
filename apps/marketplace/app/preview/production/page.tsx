import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductionBoard } from "@faden/ui";
import { sampleProductionOrders } from "../../../lib/production-preview";
export default function ProductionPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <div className="atelier-layout">
      <aside className="atelier-sidebar">
        <Link href="/" className="atelier-brand">
          FADEN
        </Link>
        <p>Atelier management · sample</p>
        <nav aria-label="Sample navigation">
          <Link href="/preview/production" aria-current="page">
            Production Board
          </Link>
          <Link href="/preview/journey">Customer journey</Link>
          <Link href="/preview/design-approval">Design approval</Link>
          <Link href="/">Marketplace</Link>
        </nav>
      </aside>
      <main className="atelier-main">
        <ProductionBoard orders={sampleProductionOrders} demo />
      </main>
    </div>
  );
}
