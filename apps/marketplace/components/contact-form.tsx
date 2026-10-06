"use client";

import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Sending your enquiry…");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const result = (await response.json()) as {
      error?: string;
      reference?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setStatus(
        result.error ||
          "We could not send your enquiry. Please email us instead.",
      );
      return;
    }
    event.currentTarget.reset();
    setStatus(`Thank you. Your enquiry is saved as ${result.reference}.`);
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-form__trap" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label>
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={255}
          autoComplete="email"
        />
      </label>
      <label>
        Enquiry type
        <select name="category" defaultValue="general">
          <option value="general">General enquiry</option>
          <option value="boutique">Boutique partnership</option>
          <option value="press">Press and collaborations</option>
          <option value="privacy">Privacy request</option>
          <option value="technical">Technical help</option>
        </select>
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
        />
      </label>
      <button className="offer-btn" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send enquiry"}
      </button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
