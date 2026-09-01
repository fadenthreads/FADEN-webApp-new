"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFadenBrowserClient } from "@faden/supabase";
export function DesignEditor({
  orderId,
  revision,
}: {
  orderId: string;
  revision: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [uploaded, setUploaded] = useState<{ file: File; path: string } | null>(
    null,
  );
  return (
    <form
      className="offer-panel design-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const file = form.get("sketch");
        setBusy(true);
        setMessage("");
        try {
          if (
            !(file instanceof File) ||
            !file.size ||
            file.size > 8388608 ||
            !["image/jpeg", "image/png", "image/webp"].includes(file.type)
          )
            throw new Error("Choose a JPEG, PNG or WebP sketch under 8 MB.");
          const supabase = createFadenBrowserClient();
          let path =
            uploaded?.file.name === file.name &&
            uploaded.file.lastModified === file.lastModified
              ? uploaded.path
              : "";
          if (!path) {
            path = `${orderId}/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
            const { error } = await supabase.storage
              .from("order-designs")
              .upload(path, file, { contentType: file.type, upsert: false });
            if (error)
              throw new Error(
                "Could not upload the sketch. Check your atelier access and try again.",
              );
            setUploaded({ file, path });
          }
          const r = await fetch("/api/design-reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              revision,
              proposal: {
                title: form.get("title"),
                note: form.get("note"),
                fabric: form.get("fabric"),
                detailing: form.get("detailing"),
                inspiration: form.get("inspiration"),
                sketch_path: path,
              },
            }),
          });
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          router.refresh();
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "Could not share the design.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Share design version {revision + 1}</h2>
      <p>
        This publishes a private, immutable version to your customer. Do not
        include private measurements or unrelated customer information. No
        payment or production action is triggered.
      </p>
      <fieldset disabled={busy}>
        <label>
          Design title
          <input name="title" required minLength={2} maxLength={120} />
        </label>
        <label>
          Private sketch (JPEG, PNG, WebP; up to 8 MB)
          <input
            name="sketch"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={() => setUploaded(null)}
          />
        </label>
        <label>
          Designer&apos;s note
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={3000}
            rows={5}
          />
        </label>
        <label>
          Fabric
          <input name="fabric" required maxLength={200} />
        </label>
        <label>
          Detailing
          <input name="detailing" required maxLength={200} />
        </label>
        <label>
          Inspiration summary (optional)
          <input name="inspiration" maxLength={200} />
        </label>
        <label className="design-confirm">
          <input type="checkbox" required />I confirm this version is ready to
          share. Its sketch and details cannot be edited after submission.
        </label>
        <button className="design-primary" disabled={busy}>
          {busy ? "Sharing…" : "Share design for review"}
        </button>
      </fieldset>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
