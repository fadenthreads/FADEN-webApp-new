"use client";
import { useState, type FormEvent } from "react";

export function StudioAccountForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save account details.");
      setMessage(
        "Account details saved. These do not change your verified business identity.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save account details.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="offer-panel storefront-form">
      <h2>Your account</h2>
      <p>
        This is your personal Studio account. Public boutique details are
        managed separately.
      </p>
      <fieldset disabled={busy} className="storefront-fields">
        <label>
          Display name
          <input
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
          />
        </label>
        <label>
          Contact phone
          <input
            name="phone"
            defaultValue={phone}
            type="tel"
            maxLength={24}
            autoComplete="tel"
            placeholder="+91 …"
          />
        </label>
        <label className="wide">
          Sign-in email
          <input value={email} readOnly type="email" />
          <small>
            Email/login changes require the authentication support flow; this
            field is read-only.
          </small>
        </label>
      </fieldset>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <button type="submit" className="offer-btn" disabled={busy}>
        {busy ? "Saving…" : "Save account details"}
      </button>
    </form>
  );
}
