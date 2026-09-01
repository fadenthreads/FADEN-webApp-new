"use client";
import { useState } from "react";
export function AtelierNotes({
  shareId,
  initial,
}: {
  shareId: string;
  initial: string;
}) {
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="offer-panel offer-form">
      <h2>Atelier Notes</h2>
      <p>
        Private to your atelier owner account. Never included in customer
        proposals.
      </p>
      <label>
        Internal notes
        <textarea
          rows={4}
          maxLength={5000}
          disabled={busy}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setMessage("");
          }}
        />
      </label>
      <button
        className="offer-btn secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/offers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "notes", shareId, notes }),
            });
            const d = await r.json();
            setMessage(r.ok ? "Private notes saved." : d.error);
          } catch {
            setMessage("Could not save. Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save note"}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
