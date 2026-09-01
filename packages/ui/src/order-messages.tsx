"use client";
import { useRef, useState } from "react";

export type OrderMessage = {
  id: string;
  sequence: number;
  sender_id: string;
  body: string;
  created_at: string;
};
export function OrderMessages({
  orderId,
  viewerId,
  boutiqueName,
  messages,
  unread,
  readThrough,
  eligible,
  demo = false,
}: {
  orderId: string;
  viewerId: string;
  boutiqueName: string;
  messages: OrderMessage[];
  unread: number;
  readThrough: number;
  eligible: boolean;
  demo?: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const command = useRef<{ id: string; body: string } | null>(null);
  async function submit(action: "send" | "read") {
    if (busy || demo) return;
    setBusy(true);
    setError("");
    const text = body.trim();
    if (action === "send" && command.current?.body !== text)
      command.current = { id: crypto.randomUUID(), body: text };
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId,
          body: text,
          commandId: command.current?.id,
          through: readThrough,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save your message.");
      // Successful POST reloads server-rendered messages and unread counts.
      window.location.assign(window.location.pathname);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection failed. Retry to send this message once.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="order-chat" aria-labelledby="chat-title">
      <header>
        <p className="chat-eyebrow">YOUR PRIVATE ATELIER</p>
        <h1 id="chat-title">A conversation, beautifully personal.</h1>
        <p>Order conversation · {boutiqueName}</p>
      </header>
      <p className="chat-notice">
        {demo
          ? "Fictional design preview — sending is disabled."
          : "Staging conversation — messages are saved and visible to the other order participant."}{" "}
        Text only. No email or SMS is sent. Never share passwords, payment
        details or identity documents.
      </p>
      <div className="chat-toolbar">
        <strong>
          {unread} unread {unread === 1 ? "message" : "messages"}
        </strong>
        <div>
          <button
            disabled={demo || busy}
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
          <button
            disabled={demo || busy || !readThrough || !unread}
            onClick={() => void submit("read")}
          >
            Mark read through #{readThrough || "—"}
          </button>
        </div>
      </div>
      <p className="chat-hint">
        Refresh to check for replies. Marking read includes earlier messages; it
        does not notify the sender.
      </p>
      <ol className="chat-history" aria-label="Order messages">
        {messages.length ? (
          messages.map((m) => (
            <li
              key={m.id}
              className={m.sender_id === viewerId ? "mine" : "theirs"}
            >
              <div>
                <strong>
                  {m.sender_id === viewerId ? "You" : "Order partner"}
                </strong>
                <span>
                  #{m.sequence} ·{" "}
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}{" "}
                    UTC
                  </time>
                </span>
              </div>
              <p>{m.body}</p>
            </li>
          ))
        ) : (
          <li className="chat-empty">
            Every detail starts with a conversation.
            <p>Ask about your outfit, fit or the next step in your order.</p>
          </li>
        )}
      </ol>
      {error && (
        <p role="alert" className="chat-error">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit("send");
        }}
      >
        <label htmlFor="order-message">Your message</label>
        <textarea
          id="order-message"
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={demo || !eligible || busy}
          placeholder="Share a thought with your atelier…"
        />
        <div className="chat-compose-footer">
          <small>{body.length}/2000 · Text stays private to this order</small>
          <button
            disabled={demo || !eligible || busy || !body.trim()}
            type="submit"
          >
            {busy ? "Saving…" : "Send message ↗"}
          </button>
        </div>
      </form>
      {!demo && !eligible && (
        <p className="chat-notice">
          This conversation is read-only. The order may be cancelled or the
          original boutique unavailable.
        </p>
      )}
    </section>
  );
}
