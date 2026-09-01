"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFadenBrowserClient } from "@faden/supabase";
import { productionStages } from "@faden/ui";
export function ProductionEditor({
  orderId,
  sequence,
  stage,
}: {
  orderId: string;
  sequence: number;
  stage: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [commandId] = useState(() => crypto.randomUUID());
  const [uploaded, setUploaded] = useState<string | null>(null);
  return (
    <form
      className="offer-panel production-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const file = form.get("photo");
          let photo = uploaded;
          if (file instanceof File && file.size && !photo) {
            if (
              file.size > 8388608 ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            )
              throw new Error("Choose a JPEG, PNG or WebP photo up to 8 MB.");
            photo = `${orderId}/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
            const { error } = await createFadenBrowserClient()
              .storage.from("order-progress")
              .upload(photo, file, { contentType: file.type, upsert: false });
            if (error)
              throw new Error(
                "Photo upload failed. Check your atelier access and try again.",
              );
            setUploaded(photo);
          }
          const r = await fetch("/api/production", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              sequence,
              stage: Number(form.get("stage")),
              note: form.get("note"),
              photo,
              commandId,
              confirmed: form.get("confirmed") === "on",
            }),
          });
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          router.refresh();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not record progress.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Record rehearsal progress</h2>
      <p>
        Updates are immutable and visible to your customer. Do not include
        private measurements, addresses or unrelated people in photos.
      </p>
      <fieldset disabled={busy}>
        <label>
          Milestone
          <select name="stage" defaultValue={stage || 1}>
            {productionStages.map((s, i) =>
              i + 1 >= (stage || 1) &&
              i + 1 <= Math.min((stage || 0) + 1, 5) ? (
                <option key={s} value={i + 1}>
                  {s}
                </option>
              ) : null,
            )}
          </select>
        </label>
        <label>
          Progress note
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
          />
        </label>
        <label>
          Private progress photo (optional, up to 8 MB)
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={() => setUploaded(null)}
          />
        </label>
        <label className="design-confirm">
          <input type="checkbox" name="confirmed" required />I confirm this is a
          rehearsal update, not authorization for real production or a fitting
          booking.
        </label>
        <button className="offer-btn" disabled={busy}>
          {busy ? "Recording…" : "Publish rehearsal update"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
