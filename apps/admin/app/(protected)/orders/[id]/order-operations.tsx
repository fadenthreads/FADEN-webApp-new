"use client";
import { useState } from "react";
const statuses = [
  "awaiting_arrangement",
  "booked",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "cancelled",
];
export function OrderOperations({
  orderId,
  detail,
}: {
  orderId: string;
  detail: Record<string, unknown>;
}) {
  const shipment = (detail.shipment ?? {}) as Record<string, unknown>,
    fulfilment = (detail.fulfilment ?? {}) as Record<string, unknown>;
  const [message, setMessage] = useState("");
  const [address, setAddress] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({
    carrier_name: String(shipment.carrier_name ?? ""),
    tracking_number: String(shipment.tracking_number ?? ""),
    tracking_url: String(shipment.tracking_url ?? ""),
    status: String(shipment.status ?? "awaiting_arrangement"),
    admin_note: String(shipment.admin_note ?? ""),
    confirm_delivered: false,
  });
  async function send(body: Record<string, unknown>) {
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId, ...body }),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || "Unable to save");
    return json.data;
  }
  async function act(body: Record<string, unknown>) {
    try {
      await send(body);
      setMessage("Saved. Reloading current order…");
      location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    }
  }
  async function reveal() {
    const reason = prompt("Why do you need to view this address?");
    if (!reason) return;
    try {
      setAddress(
        (await send({ action: "reveal_address", reason })) as Record<
          string,
          string
        >,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to reveal address");
    }
  }
  return (
    <div className="admin-order-grid">
      <section>
        <h2>Fulfilment</h2>
        <p>
          {shipment.id
            ? "Manual shipment recorded."
            : "No shipment yet. Captured payment is required before recording a shipment."}
        </p>
        <button
          className="button button--secondary"
          onClick={() =>
            act({
              action: fulfilment.claimed_by ? "unclaim" : "claim",
              expected_version: fulfilment.version ?? null,
            })
          }
        >
          {fulfilment.claimed_by ? "Unclaim order" : "Claim fulfilment"}
        </button>
        <button
          className="button button--secondary"
          onClick={reveal}
          disabled={!detail.address_available}
        >
          Reveal delivery address
        </button>
        {address && (
          <address className="admin-address">
            {Object.values(address).map((x) => (
              <div key={x}>{x}</div>
            ))}
          </address>
        )}
      </section>
      <section>
        <h2>Manual shipment</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act({
              action: "shipment",
              expected_version: shipment.version ?? 0,
              ...form,
            });
          }}
          className="admin-shipment-form"
        >
          <label>
            Carrier
            <input
              required
              value={form.carrier_name}
              onChange={(e) =>
                setForm({ ...form, carrier_name: e.target.value })
              }
            />
          </label>
          <label>
            Tracking number
            <input
              required
              value={form.tracking_number}
              onChange={(e) =>
                setForm({ ...form, tracking_number: e.target.value })
              }
            />
          </label>
          <label>
            Tracking URL{" "}
            <input
              type="url"
              placeholder="https://"
              value={form.tracking_url}
              onChange={(e) =>
                setForm({ ...form, tracking_url: e.target.value })
              }
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Private Admin note
            <textarea
              value={form.admin_note}
              onChange={(e) => setForm({ ...form, admin_note: e.target.value })}
            />
          </label>
          {form.status === "delivered" && (
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.confirm_delivered}
                onChange={(e) =>
                  setForm({ ...form, confirm_delivered: e.target.checked })
                }
              />{" "}
              I confirm delivery was verified.
            </label>
          )}
          <button className="button" type="submit">
            Save shipment
          </button>
        </form>
      </section>
      <section>
        <h2>Private notes</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act({ action: "note", body: note });
          }}
        >
          <textarea
            aria-label="Private note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Visible only to Admin"
          />
          <button className="button button--secondary" type="submit">
            Add note
          </button>
        </form>
        {((detail.notes ?? []) as Array<Record<string, string>>).map((n) => (
          <p className="admin-private-note" key={n.id}>
            {n.body}
          </p>
        ))}
      </section>
      <section>
        <h2>Timeline</h2>
        {((detail.timeline ?? []) as Array<Record<string, string>>).length ===
        0 ? (
          <p>No manual shipment updates yet.</p>
        ) : (
          ((detail.timeline ?? []) as Array<Record<string, string>>).map(
            (e, i) => (
              <p key={i}>
                <strong>{e.status}</strong>{" "}
                <time>{new Date(e.created_at).toLocaleString("en-IN")}</time>
              </p>
            ),
          )
        )}
      </section>
      {message && (
        <p role="status" className="admin-order-message">
          {message}
        </p>
      )}
    </div>
  );
}
