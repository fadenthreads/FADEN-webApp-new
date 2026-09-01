"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OfferAction } from "@faden/ui";
type Share = {
  id: string;
  boutique_id: string;
  include_measurements: boolean;
  include_inspiration: boolean;
  revoked_at: string | null;
};
export function RequestSharing({
  requestId,
  boutiques,
  shares,
  selected,
}: {
  requestId: string;
  boutiques: { id: string; name: string; city: string | null }[];
  shares: Share[];
  selected: string | null;
}) {
  const router = useRouter();
  const available = boutiques.filter(
    (b) => !shares.some((s) => s.boutique_id === b.id),
  );
  const [boutique, setBoutique] = useState(
    available.some((b) => b.id === selected)
      ? selected!
      : (available[0]?.id ?? ""),
  );
  const [measurements, setMeasurements] = useState(false);
  const [inspiration, setInspiration] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="offer-form">
      <h2>Invite your boutiques</h2>
      <p>
        Choose up to three verified boutiques. They receive your display name,
        occasion, style, notes, budget and dates. Check your notes for personal
        information before sharing.
      </p>
      <div className="offer-panel">
        <fieldset disabled={busy}>
          <label>
            Boutique
            <select
              value={boutique}
              onChange={(e) => {
                setBoutique(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">Choose a boutique</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.city}
                </option>
              ))}
            </select>
          </label>
          <label className="offer-check">
            <input
              type="checkbox"
              checked={measurements}
              onChange={(e) => {
                setMeasurements(e.target.checked);
                setConfirmed(false);
              }}
            />
            Include measurements saved in this request (not my reusable
            profile).
          </label>
          <label className="offer-check">
            <input
              type="checkbox"
              checked={inspiration}
              onChange={(e) => {
                setInspiration(e.target.checked);
                setConfirmed(false);
              }}
            />
            Include inspiration images, image notes and reference links.
          </label>
          <label className="offer-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I approve sharing the brief and the optional details selected above
            with this boutique.
          </label>
          <button
            className="offer-btn"
            disabled={
              !confirmed ||
              !boutique ||
              shares.filter((s) => !s.revoked_at).length >= 3
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/shares", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "share",
                    requestId,
                    boutiqueId: boutique,
                    measurements,
                    inspiration,
                    confirmed,
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setConfirmed(false);
                setBoutique("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not share.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sharing…" : "Share brief →"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="offer-error">
            {error}
          </p>
        )}
      </div>
      {shares.map((s) => (
        <article className="offer-panel" key={s.id}>
          <h3>
            {boutiques.find((b) => b.id === s.boutique_id)?.name ??
              "Boutique invitation"}
          </h3>
          <p>
            {s.revoked_at ? "Access revoked" : "Brief shared"} · Measurements{" "}
            {s.include_measurements ? "included" : "private"} · Inspiration{" "}
            {s.include_inspiration ? "included" : "private"}
          </p>
          {!s.revoked_at && (
            <OfferAction
              endpoint="/api/shares"
              body={{ action: "revoke", shareId: s.id }}
              label="Revoke access"
            />
          )}
        </article>
      ))}
      <p className="offer-notice">
        Revoking access withdraws outstanding offers and blocks new reads.
        Already downloaded copies cannot be recalled; existing image preview
        links may work for up to 15 minutes. Revoked invitations cannot be
        reopened in this phase. Revocation does not cancel an accepted order:
        the boutique retains its commercial quote snapshot, without your private
        measurements or inspiration.
      </p>
    </section>
  );
}
