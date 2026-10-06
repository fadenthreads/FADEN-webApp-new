"use client";

import { useState } from "react";

type Inquiry = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
};

export function ContactInquiryList({ inquiries }: { inquiries: Inquiry[] }) {
  const [items, setItems] = useState(inquiries);
  const [message, setMessage] = useState("");

  async function update(id: string, status: string) {
    setMessage("Saving…");
    const response = await fetch("/api/contact-inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      setMessage("Could not update the enquiry.");
      return;
    }
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    setMessage("Enquiry updated.");
  }

  if (!items.length)
    return (
      <div className="admin-empty-state">
        <h2>No contact enquiries</h2>
        <p>New public contact messages will appear here.</p>
      </div>
    );
  return (
    <section className="contact-inquiry-list">
      {message && <p role="status">{message}</p>}
      {items.map((item) => (
        <article className="admin-card" key={item.id}>
          <div className="contact-inquiry-heading">
            <div>
              <h2>{item.name}</h2>
              <a href={`mailto:${item.email}`}>{item.email}</a>
            </div>
            <span>
              {item.category} · {item.status}
            </span>
          </div>
          <p>{item.message}</p>
          <small>{new Date(item.created_at).toLocaleString("en-IN")}</small>
          <div className="admin-actions">
            <button onClick={() => update(item.id, "in_progress")}>
              Mark in progress
            </button>
            <button onClick={() => update(item.id, "resolved")}>Resolve</button>
            <button onClick={() => update(item.id, "closed")}>Close</button>
          </div>
        </article>
      ))}
    </section>
  );
}
