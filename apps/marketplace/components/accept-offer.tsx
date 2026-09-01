"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AcceptOffer({
  offerId,
  version,
}: {
  offerId: string;
  version: number;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="offer-form offer-panel">
      <h2>Choose your atelier</h2>
      <p>
        Accepting saves this quote as your order and fixes your choice for this
        request. Only test payments are available; no real money is collected
        and production must not start.
      </p>
      <p>
        You can cancel before checkout starts. Changes require a new request;
        accepted quotes cannot be edited or reopened. Review the full quote
        first.
      </p>
      <label className="offer-check">
        <input
          type="checkbox"
          disabled={busy}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I accept this boutique’s itemized prices, completion date and
        fitting/alteration terms. I understand the order will remain unpaid.
      </label>
      <button
        className="offer-btn"
        disabled={!confirmed || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "accept",
                offerId,
                version,
                confirmed,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            router.push(`/orders/secure?id=${data.id}`);
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not accept the offer.",
            );
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving your choice…" : "Accept & continue →"}
      </button>
      {error && (
        <p className="offer-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
