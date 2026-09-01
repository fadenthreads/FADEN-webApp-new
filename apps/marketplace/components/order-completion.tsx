/* eslint-disable @next/next/no-img-element -- Private signed progress photos must not enter shared image caches. */
import Link from "next/link";
import "./order-completion.css";
export function OrderCompletion({
  imageUrl,
  backHref,
  aftercareHref,
  messagesHref,
  demo = false,
}: {
  imageUrl?: string;
  backHref: string;
  aftercareHref: string;
  messagesHref: string;
  demo?: boolean;
}) {
  return (
    <div className="completion-page">
      <main>
        <header>
          <div className="completion-spark" aria-hidden="true">
            ✧
          </div>
          <h1>Made especially for you.</h1>
          <p>
            Your bespoke journey, brought together. Thank you for trusting our
            atelier.
          </p>
        </header>
        <p className="completion-notice">
          {demo ? "Fictional design preview" : "Delivery rehearsal complete"} ·
          This screen is not proof of manufacture, shipment, payment or receipt
          of a real outfit.
        </p>
        <div className="completion-grid">
          <div className="completion-image">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={
                  demo
                    ? "Original Stitch editorial: terracotta tailored suit"
                    : "Latest private rehearsal progress photo — not delivery evidence"
                }
              />
            ) : (
              <div className="completion-no-photo">
                Your outfit story.<p>No progress photo has been shared yet.</p>
              </div>
            )}
          </div>
          <section className="completion-actions" aria-label="Aftercare">
            <Link
              className="completion-action"
              href={`${aftercareHref}#review`}
            >
              Leave a Review
            </Link>
            <Link
              className="completion-action outline"
              href={`${aftercareHref}#alterations`}
            >
              Request an Alteration
            </Link>
            <p className="completion-help">
              Open private aftercare rehearsal. Feedback never changes public
              ratings; no real alteration work is arranged.
            </p>
            <div className="completion-divider" />
            <Link href="/create">↗ Start another outfit</Link>
            <button className="text" disabled>
              ▤ Download Invoice — unavailable
            </button>
            <Link href={messagesHref}>□ Message Boutique</Link>
            <Link href={backHref}>← Back to delivery rehearsal</Link>
          </section>
        </div>
      </main>
      <footer>
        <Link href="/">FADEN</Link>
        <div className="completion-footer-labels">
          <span>Provenance</span>
          <span>Craftsmanship</span>
          <span>Concierge</span>
          <span>Legal</span>
        </div>
        <p>Preview only · Footer information pages are not connected.</p>
        <small>© 2026 FADEN DIGITAL ATELIER. ALL RIGHTS RESERVED.</small>
      </footer>
    </div>
  );
}
