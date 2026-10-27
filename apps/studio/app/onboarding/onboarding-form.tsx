"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function OnboardingForm() {
  const router = useRouter();
  const supabase = useMemo(() => createFadenBrowserClient(), []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("create_boutique_application", {
        boutique_city: city.trim(),
        boutique_description: description.trim() || undefined,
        boutique_name: name.trim(),
        boutique_slug: slug,
      });
      if (error) {
        setMessage(
          error.code === "23505"
            ? "That public handle is already taken. Please choose another."
            : "Your boutique could not be saved. Check your details and try again. If you already registered, open Overview.",
        );
        return;
      }
      router.push("/verification");
      router.refresh();
    } catch {
      setMessage(
        "We could not connect. Your entered details are still here; please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-card onboarding-form" onSubmit={submit}>
      <div className="settings-card__heading">
        <div>
          <p className="eyebrow">Boutique application</p>
          <h2>Tell us about your atelier.</h2>
        </div>
        <span className="status-pill status-pill--next">
          Verification follows
        </span>
      </div>
      <div className="form-grid">
        <label>
          Boutique name
          <input
            maxLength={120}
            minLength={2}
            onChange={(event) => {
              setName(event.target.value);
              if (!slug || slug === makeSlug(name))
                setSlug(makeSlug(event.target.value));
            }}
            required
            value={name}
          />
        </label>
        <label>
          Public handle
          <div className="input-prefix">
            <span>faden.in/boutiques/</span>
            <input
              maxLength={60}
              minLength={3}
              onChange={(event) => setSlug(makeSlug(event.target.value))}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
            />
          </div>
        </label>
        <label>
          City
          <input
            minLength={2}
            maxLength={120}
            onChange={(event) => setCity(event.target.value)}
            required
            value={city}
          />
        </label>
        <label className="form-field--wide">
          Your design point of view
          <textarea
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            value={description}
          />
        </label>
      </div>
      <div className="notice-box">
        <strong>What happens next?</strong>
        <p>
          Step 1: create your boutique. Step 2: add legal details and upload
          verification documents. Step 3: submit for Admin review. Your boutique
          is not visible to customers before approval.
        </p>
      </div>
      <button className="button button--primary" disabled={busy}>
        {busy
          ? "Creating your studio…"
          : "Save boutique & continue to verification"}
      </button>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
