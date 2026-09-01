"use client";
import { useState } from "react";
export function OfferAction({
  endpoint,
  body,
  label,
}: {
  endpoint: string;
  body: Record<string, unknown>;
  label: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <div className="offer-actions">
        <button
          className="offer-btn secondary"
          disabled={busy}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            setBusy(true);
            setError("");
            try {
              const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              window.location.reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please retry.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : confirm ? `Confirm: ${label}` : label}
        </button>
        {confirm && !busy && (
          <button
            className="offer-btn secondary"
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="offer-error">
          {error}
        </p>
      )}
    </div>
  );
}
