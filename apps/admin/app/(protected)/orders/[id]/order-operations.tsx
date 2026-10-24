"use client";
import { useState } from "react";
import { deliveryStatusLabel } from "@faden/ui";
const nextStatuses: Record<string, string[]> = {
  awaiting_arrangement: ["awaiting_arrangement", "booked", "cancelled"],
  booked: ["booked", "picked_up", "exception", "cancelled"],
  picked_up: ["picked_up", "in_transit", "exception"],
  in_transit: ["in_transit", "out_for_delivery", "exception"],
  out_for_delivery: ["out_for_delivery", "delivered", "exception"],
  delivered: [],
  cancelled: [],
};
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
  const supportCases = (detail.supportCases ?? []) as Array<
    Record<string, string>
  >;
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const currentStatus = String(shipment.status ?? "awaiting_arrangement");
  const allowedStatuses = shipment.id
    ? (nextStatuses[currentStatus] ?? statuses)
    : ["awaiting_arrangement", "booked"];
  const paid = ((detail.payments ?? []) as Array<Record<string, unknown>>).some(
    (payment) => payment.status === "captured",
  );
  const [address, setAddress] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
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
    if (saving) return;
    setSaving(true);
    try {
      await send(body);
      setMessage("Saved. Reloading current order…");
      location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
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
  async function refund() {
    if (
      !confirm(
        "Start this test refund? It will remain pending until Razorpay confirms it.",
      )
    )
      return;
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          amount_paise: Math.round(Number(refundAmount) * 100),
          reason: refundReason,
        }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "Refund could not be started");
      setMessage("Refund started. Razorpay confirmation is pending.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Refund could not be started",
      );
    }
  }
  async function updateSupport(caseId: string, status: string) {
    const note = prompt("Private Admin note (optional):") ?? "";
    await act({ action: "support", case_id: caseId, status, note });
  }
  return (
    <div className="admin-order-grid">
      {message && (
        <p role="status" className="admin-order-message">
          {message}
        </p>
      )}
      <section id="delivery">
        <h2>Arrange delivery</h2>
        <p>
          FADEN manages delivery directly. Confirm the boutique has finished
          packing, reveal the delivery address, then arrange collection with
          your preferred courier.
        </p>
        <p>
          Current delivery status:{" "}
          <strong>{deliveryStatusLabel(currentStatus)}</strong>
        </p>
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
          <>
            <address className="admin-address">
              {Object.values(address).map((x) => (
                <div key={x}>{x}</div>
              ))}
            </address>
            <button
              type="button"
              className="button button--secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    Object.values(address).filter(Boolean).join("\n"),
                  );
                  setMessage("Delivery address copied.");
                } catch {
                  setMessage(
                    "Could not copy. Select and copy the address above.",
                  );
                }
              }}
            >
              Copy address for courier
            </button>
          </>
        )}
      </section>
      <section>
        <h2>Delivery details & customer updates</h2>
        <p>
          Carrier, tracking and status updates appear on the customer’s delivery
          page. Private notes stay visible only to admins. Delivery emails use
          the existing notification queue.
        </p>
        {!paid && (
          <p role="status">
            Payment must be captured before recording a shipment.
          </p>
        )}
        {!allowedStatuses.length && (
          <p>
            This shipment is {deliveryStatusLabel(currentStatus).toLowerCase()}{" "}
            and cannot be changed here.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!paid || saving || !allowedStatuses.length) return;
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
              pattern="https://.*"
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
              {(allowedStatuses.length ? allowedStatuses : [currentStatus]).map(
                (s) => (
                  <option value={s} key={s}>
                    {deliveryStatusLabel(s)}
                  </option>
                ),
              )}
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
          <button
            className="button"
            type="submit"
            disabled={
              saving ||
              !paid ||
              !allowedStatuses.length ||
              (form.status === "delivered" && !form.confirm_delivered)
            }
          >
            {saving ? "Saving update…" : "Save delivery update"}
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
        <h2>Test refund</h2>
        <p>
          Only use this with Razorpay test payments. Provider confirmation is
          required before the refund is final.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            refund();
          }}
          className="admin-shipment-form"
        >
          <label>
            Amount (₹)
            <input
              required
              min="1"
              step="0.01"
              type="number"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
          </label>
          <label>
            Reason
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            Start test refund
          </button>
        </form>
      </section>
      <section>
        <h2>Support cases</h2>
        {supportCases.length ? (
          supportCases.map((support) => (
            <div key={support.id} className="admin-private-note">
              <strong>
                {support.kind}: {support.subject}
              </strong>
              <p>Current status: {support.status}</p>
              <select
                aria-label={`Status for ${support.subject}`}
                value={support.status}
                onChange={(event) =>
                  updateSupport(support.id, event.target.value)
                }
              >
                <option value="open">Open</option>
                <option value="awaiting_customer">Awaiting customer</option>
                <option value="awaiting_boutique">Awaiting boutique</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          ))
        ) : (
          <p>No support cases for this order.</p>
        )}
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
    </div>
  );
}
