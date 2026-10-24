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
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <form
      className="offer-panel production-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        setSuccess("");
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
          setSuccess(
            "Update published. Your customer can now see it in their outfit journey.",
          );
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
      <h2>Send an order update to your customer</h2>
      <p>
        Post a short note whenever work progresses, even if the milestone has
        not changed. Aim to update your customer every few days and explain any
        delays. Published notes are visible in their outfit journey.
      </p>
      <p>
        Include what you finished, what comes next and when they can expect
        another update. Keep private measurements and addresses out of notes and
        photos.
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
          Customer update
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="We’ve completed… Next we’re working on… Your next update will be…"
          />
        </label>
        <label>
          Progress photo for your customer (optional, up to 8 MB)
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={() => setUploaded(null)}
          />
        </label>
        <label className="design-confirm">
          <input type="checkbox" name="confirmed" required />I confirm this
          update is accurate and contains no private measurements, delivery
          address or unrelated people.
        </label>
        <button className="offer-btn" disabled={busy}>
          {busy ? "Sending…" : "Send customer update"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </form>
  );
}
