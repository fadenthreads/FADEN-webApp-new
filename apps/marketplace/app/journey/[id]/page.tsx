import { briefText } from "@faden/ui";
import { customerOrder } from "../../../lib/orders";
import { getSupabaseServerClient } from "../../../lib/supabase/server";
import { OutfitJourney } from "../../../components/outfit-journey";
export default async function Journey({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await customerOrder(id);
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_design_reviews")
    .select()
    .eq("order_id", id)
    .order("revision", { ascending: false })
    .limit(20);
  if (error) throw new Error("Could not load your journey. Please try again.");
  const { data: updates, error: progressError } = await supabase
    .from("order_production_updates")
    .select()
    .eq("order_id", id)
    .order("sequence", { ascending: false })
    .limit(100);
  if (progressError) throw new Error("Could not load your progress updates.");
  const progress = await Promise.all(
    (updates ?? []).map(async (p) => ({
      ...p,
      photoUrl: p.photo_path
        ? (
            await supabase.storage
              .from("order-progress")
              .createSignedUrl(p.photo_path, 300)
          ).data?.signedUrl
        : undefined,
    })),
  );
  return (
    <OutfitJourney
      title={briefText(o.quote, "title")}
      boutique={o.boutique_name}
      acceptedAt={o.accepted_at}
      reviews={data ?? []}
      progress={progress}
      approvalHref={`/orders/${id}/approval`}
      orderHref={`/orders/${id}`}
      cancelled={o.status === "cancelled"}
    />
  );
}
