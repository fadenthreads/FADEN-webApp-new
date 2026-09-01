"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { appointmentTime } from "./appointments";
export interface AftercareItem {
  id: string;
  kind: string;
  rating: number | null;
  body: string;
  status: string;
  version: number;
  created_at: string;
}
export interface AftercareEvent {
  id: string;
  item_id: string;
  version: number;
  status: string;
  note: string;
  created_at: string;
}
const labels: Record<string, string> = {
  submitted: "Private review recorded",
  requested: "Awaiting boutique response",
  accepted: "Accepted · rehearsal",
  declined: "Declined · rehearsal",
  ready: "Ready for customer confirmation",
  closed: "Closed by customer",
  cancelled: "Cancelled by customer",
};
function AftercareForm({
  orderId,
  kind,
  item,
  owner = false,
  disabled = false,
}: {
  orderId: string;
  kind?: string;
  item?: AftercareItem;
  owner?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const actions = item
    ? owner
      ? item.status === "requested"
        ? ["accepted", "declined"]
        : item.status === "accepted"
          ? ["ready"]
          : []
      : item.status === "requested"
        ? ["cancelled"]
        : item.status === "ready"
          ? ["closed"]
          : []
    : [];
  if (item && !actions.length) return null;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!consent || disabled) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const body = item
            ? {
                action: "update",
                itemId: item.id,
                version: item.version,
                status: f.get("status"),
              }
            : {
                action: "submit",
                orderId,
                kind,
                rating: kind === "review" ? Number(f.get("rating")) : null,
              };
          const r = await fetch("/api/aftercare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...body,
              note: f.get("note"),
              commandId,
              confirmed: true,
            }),
          });
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          setConsent(false);
          setCommandId(crypto.randomUUID());
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={disabled || busy}>
        {kind === "review" && (
          <label>
            Preview rating
            <select name="rating" required defaultValue="">
              <option value="" disabled>
                Choose a rating
              </option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} out of 5
                </option>
              ))}
            </select>
          </label>
        )}
        {item && (
          <label>
            Response
            <select name="status">
              {actions.map((a) => (
                <option key={a} value={a}>
                  {labels[a]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {item
            ? "Response note"
            : kind === "review"
              ? "Your private feedback"
              : "What would you like adjusted?"}
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={2000}
            placeholder="10–2000 characters. Do not include addresses, contact details or private measurements."
          />
        </label>
        <label className="fulfilment-consent">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I confirm this private rehearsal entry. It is shared with the order
          customer and boutique, cannot be edited here, and does not arrange
          real alteration work or change public ratings.
        </label>
        <button className="offer-btn" disabled={disabled || busy || !consent}>
          {busy
            ? "Saving…"
            : item
              ? "Save rehearsal response"
              : kind === "review"
                ? "Save private preview review"
                : "Submit alteration rehearsal"}
        </button>
      </fieldset>
    </form>
  );
}
export function AftercarePanel({
  orderId,
  items,
  events,
  owner = false,
  eligible = false,
  demo = false,
}: {
  orderId: string;
  items: AftercareItem[];
  events: AftercareEvent[];
  owner?: boolean;
  eligible?: boolean;
  demo?: boolean;
}) {
  const review = items.find((i) => i.kind === "review");
  const alterations = items.filter((i) => i.kind === "alteration");
  const open = alterations.some((i) =>
    ["requested", "accepted", "ready"].includes(i.status),
  );
  return (
    <section className="fulfilment-panel aftercare">
      <span className="offer-kicker">Thoughtful care · after delivery</span>
      <h1>The finishing touches.</h1>
      <p className="design-notice">
        {demo ? "Fictional sample. " : "Private rehearsal only. "}Feedback is
        not published and does not affect boutique ratings. No fees, refunds,
        pickups, messages or real alterations are created.
      </p>
      {!eligible && !demo && (
        <p className="design-notice">
          Read-only: aftercare requires a confirmed delivery rehearsal and an
          active order. The original verified boutique must still be available
          for new submissions.
        </p>
      )}
      <div className="fulfilment-grid">
        <section className="offer-panel" id="review">
          <h2>{owner ? "Customer feedback" : "Your review"}</h2>
          <p>
            One private rehearsal review per order. Saved reviews cannot be
            edited or published in this version.
          </p>
          {review ? (
            <>
              <span className="offer-badge">
                {review.rating} / 5 · private preview
              </span>
              <p>{review.body}</p>
              <small>{appointmentTime(review.created_at)}</small>
            </>
          ) : owner ? (
            <p>No customer feedback yet.</p>
          ) : (
            <AftercareForm
              orderId={orderId}
              kind="review"
              disabled={!eligible || demo}
            />
          )}
        </section>
        <section id="alterations">
          <h2>Alteration requests</h2>
          <p>
            One active request per order. A boutique response is not a price
            quote, collection booking or promise of real work.
          </p>
          {!owner && !open && alterations.length < 10 && (
            <div className="offer-panel">
              <h3>Start a request</h3>
              <AftercareForm
                orderId={orderId}
                kind="alteration"
                disabled={!eligible || demo}
              />
            </div>
          )}
          {!alterations.length && <p>No alteration requests yet.</p>}
          {alterations.map((i) => (
            <article className="offer-panel" key={i.id}>
              <span className="offer-badge">{labels[i.status]}</span>
              <h3>Request {i.id.slice(0, 8)}</h3>
              <p>{i.body}</p>
              <small>Requested {appointmentTime(i.created_at)}</small>
              <ol className="shipment-history">
                {events
                  .filter((e) => e.item_id === i.id)
                  .map((e) => (
                    <li key={e.id}>
                      <strong>{labels[e.status]}</strong>
                      <p>{e.note}</p>
                      <small>{appointmentTime(e.created_at)}</small>
                    </li>
                  ))}
              </ol>
              <AftercareForm
                key={i.version}
                orderId={orderId}
                item={i}
                owner={owner}
                disabled={!eligible || demo}
              />
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
