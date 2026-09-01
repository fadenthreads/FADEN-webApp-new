import { parseQuote, money } from "./offer-model";
export function QuoteSummary({
  quote,
  subtotal,
  tax,
  total,
}: {
  quote: unknown;
  subtotal: number;
  tax: number;
  total: number;
}) {
  const q = parseQuote(quote);
  return (
    <section className="offer-panel quote-summary">
      <h2>Design Breakdown</h2>
      <ul className="quote-lines">
        {q.items.map((item, i) => (
          <li key={i}>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              <small>
                {item.quantity} × {money(item.unit_paise)}
              </small>
            </div>
            <span>{money(item.quantity * item.unit_paise)}</span>
          </li>
        ))}
      </ul>
      <dl className="quote-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div>
          <dt>Tax ({q.tax_bps / 100}%)</dt>
          <dd>{money(tax)}</dd>
        </div>
        <div className="quote-grand">
          <dt>Total · INR</dt>
          <dd>{money(total)}</dd>
        </div>
        <div>
          <dt>Advance requested</dt>
          <dd>{money(q.advance_paise)}</dd>
        </div>
        <div>
          <dt>Remaining balance</dt>
          <dd>{money(total - q.advance_paise)}</dd>
        </div>
      </dl>
      <div className="offer-facts">
        <div>
          <small>Expected completion</small>
          <p>{q.delivery_date || "Not set"}</p>
        </div>
        <div>
          <small>Valid through (UTC)</small>
          <p>{q.expires_on || "Not set"}</p>
        </div>
      </div>
      <h3>Fitting, alteration & delivery terms</h3>
      <p className="preserve-lines">{q.terms || "Not added yet."}</p>
    </section>
  );
}
