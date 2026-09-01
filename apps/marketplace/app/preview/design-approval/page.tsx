import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignReviewView } from "@faden/ui";
import { sampleDesignReviews } from "../../../lib/design-preview";
export default function DesignPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <main className="market-page">
      <nav className="design-review-nav" aria-label="Design preview navigation">
        <Link href="/">← Marketplace</Link>
        <Link href="/preview/journey">View sample journey →</Link>
      </nav>
      <DesignReviewView
        reviews={sampleDesignReviews}
        boutique="Atelier Maison"
        demo
      />
    </main>
  );
}
