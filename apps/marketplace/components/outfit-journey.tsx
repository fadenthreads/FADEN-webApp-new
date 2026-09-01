/* eslint-disable @next/next/no-img-element -- Private signed progress photos bypass public image caching. */
import Link from "next/link";
import {
  reviewLabel,
  productionStages,
  type ProductionUpdate,
  type DesignReviewViewData,
} from "@faden/ui";
import { MarketplaceHeader } from "./marketplace-header";
import { MarketplaceFooter } from "./marketplace-footer";
export function OutfitJourney({
  title,
  boutique,
  acceptedAt,
  reviews,
  approvalHref,
  orderHref,
  cancelled = false,
  demo = false,
  progress = [],
}: {
  title: string;
  boutique: string;
  acceptedAt: string;
  reviews: DesignReviewViewData[];
  approvalHref: string;
  orderHref: string;
  cancelled?: boolean;
  demo?: boolean;
  progress?: ProductionUpdate[];
}) {
  const latest = reviews[0];
  const approved = latest?.status === "approved";
  const steps = [
    ["Order accepted", "done"],
    ["Design review", approved ? "done" : "current"],
    ...productionStages.map((label, i) => [
      label,
      (progress[0]?.stage ?? 0) >= i + 1 ? "done" : "future",
    ]),
  ];
  return (
    <div className="market-page">
      <MarketplaceHeader active="atelier" />
      <main className="journey-main">
        <header className="journey-heading">
          <span className="offer-kicker">Your journey</span>
          <h1>
            Your outfit journey,
            <br />
            step by step
          </h1>
        </header>
        {demo && (
          <p className="design-notice">
            Sample journey · fictional preview, not a real order. All progress
            below is simulated.
          </p>
        )}
        <div className="journey-card">
          <h2>{title}</h2>
          <p>by {boutique}</p>
          <span className="offer-badge">
            {cancelled
              ? "Order cancelled"
              : progress.length
                ? `Rehearsal · ${productionStages[progress[0].stage - 1]}`
                : latest
                  ? reviewLabel(latest.status)
                  : "Waiting for your first design"}
          </span>
        </div>
        <p className="design-notice">
          {cancelled
            ? "This journey is closed. Your order and design history remain available."
            : "Production updates below are rehearsals, not evidence of real manufacturing. Live production, fitting bookings, delivery tracking and live payments are not enabled yet."}
        </p>
        <ol className="journey-steps" aria-label="Order milestones">
          {steps.map(([label, state]) => (
            <li
              key={label}
              data-state={state}
              aria-current={
                !cancelled && state === "current" ? "step" : undefined
              }
            >
              <strong>{label}</strong>
              <small>
                {state === "future"
                  ? "Not started"
                  : state === "done"
                    ? "Recorded"
                    : cancelled
                      ? "Closed"
                      : "Awaiting decision"}
              </small>
            </li>
          ))}
        </ol>
        <div className="offer-actions">
          <Link className="offer-btn" href={approvalHref}>
            Review design & versions →
          </Link>
          <Link className="offer-btn secondary" href={orderHref}>
            {demo ? "Back to preview home" : "Order details"}
          </Link>
        </div>
        <h2>Progress story</h2>
        <div className="journey-story">
          {progress.map((p) => (
            <article key={p.id}>
              <span className="offer-kicker">
                Rehearsal ·{" "}
                {new Date(p.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </span>
              <h3>{productionStages[p.stage - 1]}</h3>
              {p.photoUrl && (
                <img
                  className="production-photo"
                  src={p.photoUrl}
                  alt={`Atelier progress: ${productionStages[p.stage - 1]}`}
                />
              )}
              <p>{p.note}</p>
            </article>
          ))}
          {reviews.map((r) => (
            <article key={r.id}>
              <span className="offer-kicker">
                Version {r.revision} ·{" "}
                {new Date(r.created_at).toLocaleDateString("en-IN")}
              </span>
              <h3>{reviewLabel(r.status)}</h3>
              <p>{r.designer_note}</p>
              {r.feedback && (
                <p>
                  <strong>Your feedback:</strong> {r.feedback}
                </p>
              )}
            </article>
          ))}
          <article>
            <span className="offer-kicker">
              {new Date(acceptedAt).toLocaleDateString("en-IN")}
            </span>
            <h3>Your offer was accepted</h3>
            <p>
              The boutique&apos;s quote was saved. No real money has been
              collected and your original terms are unchanged.
            </p>
          </article>
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}
