"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CancelOrder({ orderId }: { orderId: string }) {
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <section className="offer-panel">
      <h2>Cancel this unpaid order</h2>
      <p>
        Available only before checkout has started. Your quote remains in the
        history. To change the garment, price or boutique, cancel and create a
        new request; accepted quotes cannot be edited or reopened.
      </p>
      <label className="offer-check">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I want to cancel this order. This action cannot be undone.
      </label>
      <button
        className="offer-btn secondary"
        disabled={!confirmed || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "cancel",
                orderId,
                confirmed: true,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not cancel.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Cancelling…" : "Cancel unpaid order"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
