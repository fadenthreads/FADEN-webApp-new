"use client";
import { useState } from "react";
export function SupportForm({ orderId }: { orderId: string }) {
  const [kind, setKind] = useState("help"),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Sending…");
    const r = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId, kind, subject, message }),
    });
    const j = await r.json();
    setStatus(
      r.ok
        ? `Support case ${String(j.id).slice(0, 8)} is open.`
        : j.error || "Unable to open support case.",
    );
  }
  return (
    <form className="offer-panel" onSubmit={submit}>
      <label>
        How can we help?
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="help">Order help</option>
          <option value="cancellation">Request cancellation</option>
          <option value="refund">Refund question</option>
        </select>
      </label>
      <label>
        Subject
        <input
          required
          minLength={3}
          maxLength={120}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label>
        Message
        <textarea
          required
          minLength={1}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <button className="offer-btn" type="submit">
        Send to support
      </button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
