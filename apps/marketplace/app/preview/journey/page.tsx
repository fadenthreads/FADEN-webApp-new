import { notFound } from "next/navigation";
import { OutfitJourney } from "../../../components/outfit-journey";
import { sampleDesignReviews } from "../../../lib/design-preview";
import { sampleProgress } from "../../../lib/production-preview";
export default function JourneyPreview() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") notFound();
  return (
    <OutfitJourney
      title="Bespoke evening gown"
      boutique="Atelier Maison"
      acceptedAt="2026-08-27T00:00:00Z"
      reviews={sampleDesignReviews.map((r) => ({
        ...r,
        created_at: "2026-08-28T00:00:00Z",
        status: "approved",
        reviewed_at: "2026-08-28T08:00:00Z",
      }))}
      progress={sampleProgress}
      approvalHref="/preview/design-approval"
      orderHref="/preview/production"
      demo
    />
  );
}
