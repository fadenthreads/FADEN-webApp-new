/* eslint-disable @next/next/no-img-element -- Private signed photos must bypass shared image caches. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { productionStages, briefText } from "@faden/ui";
import { atelierContext } from "../../../../lib/atelier";
import { AtelierShell } from "../../../../components/atelier-shell";
import { ProductionEditor } from "../../../../components/production-editor";
export default async function ProductionOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await atelierContext();
  const { data: o, error } = await supabase
    .from("customer_orders")
    .select()
    .eq("id", id)
    .eq("boutique_owner_id", user.id)
    .maybeSingle();
  if (error?.code === "22P02") notFound();
  if (error) throw new Error("Could not load your order.");
  if (!o) notFound();
  const [
    { data: updates, error: progressError },
    { data: reviews, error: reviewError },
  ] = await Promise.all([
    supabase
      .from("order_production_updates")
      .select()
      .eq("order_id", id)
      .order("sequence", { ascending: false })
      .limit(100),
    supabase
      .from("order_design_reviews")
      .select("status")
      .eq("order_id", id)
      .order("revision", { ascending: false })
      .limit(1),
  ]);
  if (progressError || reviewError)
    throw new Error("Could not load progress. Please retry.");
  const latest = updates?.[0];
  const allowed =
    o.status !== "cancelled" &&
    reviews?.[0]?.status === "approved" &&
    (latest?.sequence ?? 0) < 100 &&
    process.env.NEXT_PUBLIC_APP_ENV !== "production";
  const history = await Promise.all(
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
    <AtelierShell active="production" name={o.boutique_name}>
      <Link href="/production">← Production board</Link>
      <h1>{briefText(o.quote, "title")}</h1>
      <p className="design-notice">
        Rehearsal only. No live production, payment, shipment or fitting booking
        is created.
      </p>
      <div className="offer-actions">
        <Link href={`/orders/${id}`}>Order details</Link>
        <Link href={`/orders/${id}/design`}>Design approval</Link>
      </div>
      {allowed ? (
        <ProductionEditor
          key={latest?.sequence ?? 0}
          orderId={id}
          sequence={latest?.sequence ?? 0}
          stage={latest?.stage ?? 0}
        />
      ) : (
        <p className="offer-notice">
          {o.status === "cancelled"
            ? "Cancelled order — read-only progress history."
            : reviews?.[0]?.status !== "approved"
              ? "Customer design approval is required before recording progress."
              : "Further rehearsal updates are unavailable. Contact support."}
        </p>
      )}
      <h2>Progress history</h2>
      {!history.length && <p>No progress updates yet.</p>}
      <div className="journey-story">
        {history.map((p) => (
          <article key={p.id}>
            <small>
              Rehearsal · update {p.sequence} ·{" "}
              {new Date(p.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </small>
            <h3>{productionStages[p.stage - 1]}</h3>
            {p.photoUrl && (
              <img
                className="production-photo"
                src={p.photoUrl}
                alt={`Progress photo: ${productionStages[p.stage - 1]}`}
              />
            )}
            <p>{p.note}</p>
            {p.photo_path && !p.photoUrl && (
              <p>Photo unavailable. Refresh to request a fresh private link.</p>
            )}
          </article>
        ))}
      </div>
    </AtelierShell>
  );
}
