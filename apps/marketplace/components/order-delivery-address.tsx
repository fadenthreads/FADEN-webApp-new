"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const fields = [
  ["recipient", "Recipient name", "name"],
  ["phone", "Mobile number (+91…)", "tel"],
  ["line1", "Address line 1", "address-line1"],
  ["line2", "Address line 2 (optional)", "address-line2"],
  ["city", "City", "address-level2"],
  ["state", "State / union territory", "address-level1"],
  ["postal_code", "PIN code", "postal-code"],
] as const;

export function OrderDeliveryAddress({
  orderId,
  revision,
  address,
  locked,
}: {
  orderId: string;
  revision: number;
  address: Record<string, string>;
  locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked) return;
    const form = new FormData(event.currentTarget);
    const details: Record<string, string> = { country: "IN" };
    for (const [key] of fields)
      details[key] = String(form.get(key) ?? "").trim();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/fulfilment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "address",
          orderId,
          revision,
          details,
          commandId,
          confirmed: true,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || "Could not save your address. Please retry.",
        );
      setSuccess("Your delivery address is saved for this order.");
      setCommandId(crypto.randomUUID());
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your address.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="offer-panel">
      <h2>Delivery address</h2>
      {locked ? (
        <>
          {revision > 0 ? (
            <address>
              {fields.map(([key]) =>
                address[key] ? <div key={key}>{address[key]}</div> : null,
              )}
              <div>India</div>
            </address>
          ) : (
            <p>
              No address has been saved. Please contact FADEN before delivery.
            </p>
          )}
          <p>
            Address changes are closed for this order. Contact FADEN for
            corrections.
          </p>
        </>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={busy} className="order-address-fields">
            <legend>Indian delivery address</legend>
            {fields.map(([key, label, autoComplete]) => (
              <label key={key} htmlFor={`delivery-${key}`}>
                {label}
                <input
                  id={`delivery-${key}`}
                  name={key}
                  autoComplete={autoComplete}
                  defaultValue={address[key] ?? ""}
                  required={key !== "line2"}
                  maxLength={key === "recipient" ? 100 : 200}
                  type={key === "phone" ? "tel" : "text"}
                  inputMode={key === "postal_code" ? "numeric" : undefined}
                  pattern={
                    key === "phone"
                      ? "\\+91[6-9][0-9]{9}"
                      : key === "postal_code"
                        ? "[1-9][0-9]{5}"
                        : undefined
                  }
                />
              </label>
            ))}
            <label className="order-address-consent">
              <input type="checkbox" required />I confirm this address and agree
              to share it with FADEN and my order boutique to arrange delivery.
            </label>
            <button className="offer-btn" disabled={busy}>
              {busy ? "Saving…" : "Save delivery address"}
            </button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
