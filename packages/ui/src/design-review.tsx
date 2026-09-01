/* eslint-disable @next/next/no-img-element -- Private expiring sketches must not pass through a public image-optimization cache. */
import type { ReactNode } from "react";

export interface DesignReviewViewData {
  id: string;
  revision: number;
  title: string;
  designer_note: string;
  fabric: string;
  detailing: string;
  inspiration: string;
  status: string;
  feedback: string;
  created_at: string;
  reviewed_at: string | null;
  sketchUrl?: string;
}
export function reviewLabel(status: string) {
  return status === "approved"
    ? "Design approved"
    : status === "changes_requested"
      ? "Changes requested"
      : "Awaiting your decision";
}
export function DesignReviewView({
  reviews,
  boutique,
  actions,
  demo = false,
}: {
  reviews: DesignReviewViewData[];
  boutique: string;
  actions?: ReactNode;
  demo?: boolean;
}) {
  const latest = reviews[0];
  return (
    <div className="design-review">
      <header className="design-review-heading">
        <h1>
          {latest
            ? "Your boutique has something to show you"
            : "Your next design is taking shape"}
        </h1>
        <p>
          {latest
            ? `Review the latest design iteration for ${latest.title}.`
            : "Your boutique has not shared a design proposal yet. Check back here for your private sketch and design notes."}
        </p>
      </header>
      {demo && (
        <p className="design-notice">
          Sample design · fictional preview, not a real order. Decisions are
          disabled.
        </p>
      )}
      {latest ? (
        <div className="design-review-grid">
          <section>
            <div className="design-sketch" data-demo={demo}>
              {latest.sketchUrl ? (
                <img
                  src={latest.sketchUrl}
                  alt={`Design sketch: ${latest.title}, version ${latest.revision}`}
                />
              ) : (
                <p>
                  The private sketch could not be loaded. Refresh this page to
                  request a new secure link.
                </p>
              )}
              <span>
                Version {latest.revision} · {reviewLabel(latest.status)}
              </span>
            </div>
            <div className="design-swatches">
              {[
                ["Fabric", latest.fabric, "asset-076"],
                ["Detailing", latest.detailing, "asset-011"],
                ["Inspiration", latest.inspiration, "asset-014"],
              ].map(([label, value, asset]) => (
                <div key={label}>
                  {demo && (
                    <img
                      src={`/stitch-assets/${asset}.jpg`}
                      alt={`${label} reference`}
                    />
                  )}
                  <small>{label}</small>
                  <p>{value || "Not specified"}</p>
                </div>
              ))}
            </div>
          </section>
          <aside className="design-review-aside">
            <section className="design-designer-note">
              <h2>{boutique}</h2>
              <small>Your design team</small>
              <p>{latest.designer_note}</p>
              <a href="#design-history">View prior versions ↓</a>
            </section>
            <section className="design-decision">
              <h2>Decision</h2>
              {actions || (
                <>
                  <button disabled className="design-primary">
                    I Love It — Approve Design
                  </button>
                  <button disabled className="design-secondary">
                    Request Changes
                  </button>
                </>
              )}
              <p className="design-notice">
                Preview workflow: approval records your design decision only. It
                does not collect money, change your quote, start production or
                book delivery. Any price or date changes need a separate
                agreement.
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <div className="design-empty">
          No design submitted yet. Your accepted order and original quote remain
          unchanged.
        </div>
      )}
      {!!reviews.length && (
        <section id="design-history" className="design-history">
          <h2>Version history</h2>
          {reviews.map((r) => (
            <details key={r.id}>
              <summary>
                Version {r.revision} · {reviewLabel(r.status)} ·{" "}
                {new Date(r.created_at).toLocaleDateString("en-IN")}
              </summary>
              <h3>{r.title}</h3>
              <p>{r.designer_note}</p>
              <p>
                Fabric: {r.fabric} · Detailing: {r.detailing}
              </p>
              {r.sketchUrl && (
                <img
                  src={r.sketchUrl}
                  alt={`Archived sketch, version ${r.revision}`}
                />
              )}
              {r.feedback && (
                <p>
                  <strong>Customer feedback:</strong> {r.feedback}
                </p>
              )}
              {r.reviewed_at && (
                <p>
                  Decision recorded{" "}
                  {new Date(r.reviewed_at).toLocaleDateString("en-IN")}
                </p>
              )}
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
