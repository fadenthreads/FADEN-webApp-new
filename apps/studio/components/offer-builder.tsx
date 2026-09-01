"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  emptyQuote,
  parseQuote,
  quoteTotals,
  money,
  type Quote,
} from "@faden/ui";
export function OfferBuilder({
  shareId,
  initial,
  version,
  title,
}: {
  shareId: string;
  initial: Quote | null;
  version: number;
  title: string;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote>(
    initial ?? { ...emptyQuote, title },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update<K extends keyof Quote>(key: K, value: Quote[K]) {
    setQuote((q) => ({ ...q, [key]: value }));
    setConfirm(false);
    setDirty(true);
    setError("");
  }
  const totals = quoteTotals(quote);
  async function save(send: boolean) {
    setBusy(true);
    setError("");
    try {
      const cleaned = parseQuote(quote);
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          shareId,
          version,
          quote: cleaned,
          send,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDirty(false);
      router.push(`/offers/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="offer-form">
      <fieldset disabled={busy}>
        <section className="offer-panel">
          <h2>Itemized Quote</h2>
          <label>
            Proposal title
            <input
              maxLength={160}
              value={quote.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </label>
          {quote.items.map((item, index) => (
            <div className="quote-item" key={index}>
              <label>
                Item {index + 1}
                <input
                  maxLength={120}
                  value={item.label}
                  onChange={(e) =>
                    update(
                      "items",
                      quote.items.map((i, n) =>
                        n === index ? { ...i, label: e.target.value } : i,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Details / type
                <input
                  maxLength={300}
                  value={item.detail}
                  onChange={(e) =>
                    update(
                      "items",
                      quote.items.map((i, n) =>
                        n === index ? { ...i, detail: e.target.value } : i,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={item.quantity}
                  onChange={(e) =>
                    update(
                      "items",
                      quote.items.map((i, n) =>
                        n === index
                          ? { ...i, quantity: Number(e.target.value) }
                          : i,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Unit price (₹)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step=".01"
                  value={item.unit_paise / 100}
                  onChange={(e) =>
                    update(
                      "items",
                      quote.items.map((i, n) =>
                        n === index
                          ? {
                              ...i,
                              unit_paise: Math.round(
                                Number(e.target.value) * 100,
                              ),
                            }
                          : i,
                      ),
                    )
                  }
                />
              </label>
              <button
                aria-label={`Remove item ${index + 1}`}
                disabled={quote.items.length === 1}
                onClick={() =>
                  update(
                    "items",
                    quote.items.filter((_, n) => n !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="offer-btn secondary"
            disabled={quote.items.length >= 20}
            onClick={() =>
              update("items", [
                ...quote.items,
                { label: "", detail: "", quantity: 1, unit_paise: 0 },
              ])
            }
          >
            + Add line item
          </button>
          <p>
            Include all material, labour, fitting and delivery charges as line
            items. Prices are in INR.
          </p>
        </section>
        <div className="offer-split">
          <section className="offer-panel">
            <h2>Terms & dates</h2>
            <div className="offer-fields">
              <label>
                Advance requested (₹)
                <input
                  type="number"
                  min={0}
                  step=".01"
                  value={quote.advance_paise / 100}
                  onChange={(e) =>
                    update(
                      "advance_paise",
                      Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
              </label>
              <label>
                Tax rate (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step=".01"
                  value={quote.tax_bps / 100}
                  onChange={(e) =>
                    update("tax_bps", Math.round(Number(e.target.value) * 100))
                  }
                />
              </label>
              <label>
                Expected completion
                <input
                  type="date"
                  value={quote.delivery_date}
                  onChange={(e) => update("delivery_date", e.target.value)}
                />
              </label>
              <label>
                Offer valid through (UTC)
                <input
                  type="date"
                  value={quote.expires_on}
                  onChange={(e) => update("expires_on", e.target.value)}
                />
              </label>
            </div>
            <p>
              Set the applicable tax rate for this quote; the app does not
              determine your tax obligations.
            </p>
            <label>
              Fitting, alteration & delivery terms
              <textarea
                rows={6}
                maxLength={5000}
                value={quote.terms}
                onChange={(e) => update("terms", e.target.value)}
                placeholder="What is included, fitting sessions, delivery terms and exclusions…"
              />
            </label>
          </section>
          <section className="offer-panel">
            <h2>Quote total</h2>
            <dl className="quote-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{money(totals.tax)}</dd>
              </div>
              <div className="quote-grand">
                <dt>Total</dt>
                <dd>{money(totals.total)}</dd>
              </div>
              <div>
                <dt>Advance</dt>
                <dd>{money(quote.advance_paise)}</dd>
              </div>
            </dl>
            <p className="offer-notice">
              Final totals are recalculated in Supabase. Sending locks the quote
              and makes it visible to the customer. It does not charge or book
              an order.
            </p>
          </section>
        </div>
        <label className="offer-check">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I have reviewed the prices, dates and terms and want to send this
          proposal to the customer.
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="offer-error">
          {error}
        </p>
      )}
      <div className="quote-bar">
        <button
          className="offer-btn secondary"
          disabled={busy}
          onClick={() => save(false)}
        >
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button
          className="offer-btn"
          disabled={busy || !confirm}
          onClick={() => save(true)}
        >
          {busy ? "Saving…" : "Send offer to client →"}
        </button>
      </div>
    </div>
  );
}
