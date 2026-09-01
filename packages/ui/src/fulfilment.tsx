"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
export const shipmentStages = [
  "Packed",
  "Handover",
  "In transit",
  "Out for delivery",
  "Delivered",
];
export interface ShipmentEvent {
  id: string;
  sequence: number;
  stage: number;
  note: string;
  created_at: string;
}
export interface DeliveryDetails {
  revision: number;
  address: unknown;
}
const fields = [
  ["recipient", "Recipient name", "name"],
  ["phone", "Mobile (+91…)", "tel"],
  ["line1", "Address line 1", "address-line1"],
  ["line2", "Address line 2 (optional)", "address-line2"],
  ["city", "City", "address-level2"],
  ["state", "State / union territory", "address-level1"],
  ["postal_code", "PIN code", "postal-code"],
] as const;
export function FulfilmentPanel({
  orderId,
  details,
  events,
  acknowledged,
  owner = false,
  readOnly = false,
  demo = false,
}: {
  orderId: string;
  details: DeliveryDetails | null;
  events: ShipmentEvent[];
  acknowledged: boolean;
  owner?: boolean;
  readOnly?: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const [consent, setConsent] = useState(false);
  const latest = events[0];
  const address =
    details?.address && typeof details.address === "object"
      ? (details.address as Record<string, string>)
      : {};
  const disabled = busy || readOnly || demo;
  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/fulfilment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, orderId, commandId, confirmed: true }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setCommandId(crypto.randomUUID());
      setConsent(false);
      setSuccess("Saved. This remains a rehearsal, not real fulfilment.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="fulfilment-panel">
      <span className="offer-kicker">The final chapter · rehearsal</span>
      <h1>From atelier to you.</h1>
      <p className="design-notice">
        {demo ? "Fictional sample. " : ""}No real parcel is booked, dispatched
        or delivered. The secure Shiprocket connection boundary is prepared, but
        credentials, courier calls, labels and notifications remain disabled.
        This does not change payment or order status.
      </p>
      {readOnly && (
        <p className="design-notice">
          Read-only history. This order cannot receive fulfilment updates.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
      <div className="fulfilment-grid">
        <section className="offer-panel">
          <h2>Delivery details</h2>
          <p className="offer-kicker">Unverified · India only</p>
          {!owner && !latest && !readOnly ? (
            <form
              key={details?.revision ?? 0}
              onSubmit={(e) => {
                e.preventDefault();
                if (!consent) return;
                const f = new FormData(e.currentTarget);
                const data: Record<string, string> = { country: "IN" };
                for (const [k] of fields)
                  data[k] = String(f.get(k) ?? "").trim();
                void send({
                  action: "address",
                  details: data,
                  revision: details?.revision ?? 0,
                });
              }}
            >
              <fieldset disabled={disabled}>
                {fields.map(([key, label, auto]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      autoComplete={auto}
                      defaultValue={address[key] ?? ""}
                      required={key !== "line2"}
                      maxLength={key === "recipient" ? 100 : 200}
                      type={key === "phone" ? "tel" : "text"}
                      pattern={
                        key === "phone"
                          ? "\\+91[6-9][0-9]{9}"
                          : key === "postal_code"
                            ? "[1-9][0-9]{5}"
                            : undefined
                      }
                      inputMode={key === "postal_code" ? "numeric" : undefined}
                    />
                  </label>
                ))}
                <label className="fulfilment-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  I confirm these details and agree to share them with the
                  boutique for this order&apos;s delivery rehearsal.
                </label>
                <button className="offer-btn" disabled={disabled || !consent}>
                  Save delivery details
                </button>
              </fieldset>
            </form>
          ) : details ? (
            <address>
              {fields
                .filter(([key]) => address[key])
                .map(([key]) => (
                  <div key={key}>{address[key]}</div>
                ))}
              <div>India</div>
            </address>
          ) : (
            <p>Waiting for the customer to confirm delivery details.</p>
          )}
          {latest && (
            <p>
              Address locked at packing rehearsal. Corrections require a future
              support workflow; no live shipment is created.
            </p>
          )}
          {owner && (
            <p>
              Customer-confirmed for this order only. No address verification or
              courier serviceability check has been performed.
            </p>
          )}
        </section>
        <section>
          <h2>Shipment rehearsal</h2>
          <div className="courier-readiness" role="status">
            <strong>Courier integration prepared</strong>
            <span>
              Shiprocket connection deferred · live booking hard-disabled
            </span>
          </div>
          {!latest && (
            <p className="offer-panel">No shipment rehearsal recorded yet.</p>
          )}
          {owner && !acknowledged && (
            <form
              className="offer-panel"
              key={latest?.sequence ?? 0}
              onSubmit={(e) => {
                e.preventDefault();
                if (!consent) return;
                const f = new FormData(e.currentTarget);
                void send({
                  action: "progress",
                  sequence: latest?.sequence ?? 0,
                  stage: Number(f.get("stage")),
                  note: f.get("note"),
                });
              }}
            >
              <h3>Record rehearsal milestone</h3>
              <p>
                Requires a customer-approved design, ready-for-fitting
                production rehearsal and confirmed delivery details.
              </p>
              <fieldset
                disabled={disabled || !details || (latest?.sequence ?? 0) >= 30}
              >
                <label>
                  Milestone
                  <select
                    name="stage"
                    defaultValue={Math.min((latest?.stage ?? 0) + 1, 5)}
                  >
                    {shipmentStages.map((label, index) =>
                      index + 1 >= (latest?.stage ?? 1) &&
                      index + 1 <= Math.min((latest?.stage ?? 0) + 1, 5) ? (
                        <option key={label} value={index + 1}>
                          {label} · rehearsal
                        </option>
                      ) : null,
                    )}
                  </select>
                </label>
                <label>
                  Customer-visible note
                  <textarea
                    name="note"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </label>
                <label className="fulfilment-consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  This simulates a shipment milestone only. Do not enter
                  tracking numbers, addresses or private measurements.
                </label>
                <button className="offer-btn" disabled={disabled || !consent}>
                  Record rehearsal
                </button>
              </fieldset>
            </form>
          )}
          <ol className="shipment-history">
            {events.map((e) => (
              <li key={e.id}>
                <span className="offer-kicker">
                  Rehearsal · update {e.sequence}
                </span>
                <h3>{shipmentStages[e.stage - 1]}</h3>
                <time dateTime={e.created_at}>
                  {new Date(e.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  IST
                </time>
                <p>{e.note}</p>
              </li>
            ))}
          </ol>
          {acknowledged ? (
            <div className="offer-panel">
              <h3>Delivery rehearsal confirmed</h3>
              <p>No real delivery or customer acceptance is implied.</p>
              {!owner && (
                <Link
                  className="offer-btn"
                  href={
                    demo ? "/preview/complete" : `/orders/${orderId}/complete`
                  }
                >
                  View completion preview →
                </Link>
              )}
            </div>
          ) : (
            !owner &&
            latest?.stage === 5 && (
              <form
                className="offer-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (consent)
                    void send({ action: "confirm", eventId: latest.id });
                }}
              >
                <h3>Confirm the rehearsal</h3>
                <label className="fulfilment-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={disabled}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  I am confirming a rehearsal only, not receipt of an actual
                  parcel or acceptance of final fit.
                </label>
                <button className="offer-btn" disabled={disabled || !consent}>
                  Confirm delivery rehearsal
                </button>
              </form>
            )
          )}
        </section>
      </div>
    </section>
  );
}
