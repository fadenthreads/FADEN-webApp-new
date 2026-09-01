export type QuoteItem = {
  label: string;
  detail: string;
  quantity: number;
  unit_paise: number;
};
export type Quote = {
  title: string;
  items: QuoteItem[];
  tax_bps: number;
  advance_paise: number;
  delivery_date: string;
  expires_on: string;
  terms: string;
};
export const emptyQuote: Quote = {
  title: "",
  items: [{ label: "Fabric", detail: "", quantity: 1, unit_paise: 0 }],
  tax_bps: 0,
  advance_paise: 0,
  delivery_date: "",
  expires_on: "",
  terms: "",
};
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function briefText(value: unknown, key: string) {
  const v = object(value)[key];
  return typeof v === "string" ? v : "";
}
export function briefList(value: unknown, key: string) {
  const v = object(value)[key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}
export function quoteTotals(q: Quote) {
  const subtotal = q.items.reduce((s, i) => s + i.quantity * i.unit_paise, 0);
  const tax = Math.round((subtotal * q.tax_bps) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}
export function parseQuote(raw: unknown): Quote {
  const q = object(raw);
  const string = (k: string, max: number) => {
    if (typeof q[k] !== "string" || (q[k] as string).length > max)
      throw new Error(`Check ${k}.`);
    return (q[k] as string).trim();
  };
  const integer = (v: unknown, max: number) => {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > max)
      throw new Error("Check price, tax and quantity.");
    return v;
  };
  if (!Array.isArray(q.items) || q.items.length < 1 || q.items.length > 20)
    throw new Error("Use one to twenty line items.");
  const items = q.items.map((x) => {
    const i = object(x);
    if (
      typeof i.label !== "string" ||
      !i.label.trim() ||
      i.label.length > 120 ||
      typeof i.detail !== "string" ||
      i.detail.length > 300
    )
      throw new Error("Check item names and descriptions.");
    const quantity = integer(i.quantity, 100);
    if (!quantity) throw new Error("Quantity must be at least one.");
    return {
      label: i.label.trim(),
      detail: i.detail,
      quantity,
      unit_paise: integer(i.unit_paise, 100000000),
    };
  });
  const result = {
    title: string("title", 160),
    items,
    tax_bps: integer(q.tax_bps, 10000),
    advance_paise: integer(q.advance_paise, 1000000000),
    delivery_date: string("delivery_date", 10),
    expires_on: string("expires_on", 10),
    terms: string("terms", 5000),
  };
  if (!result.title) throw new Error("Give your proposal a title.");
  for (const date of [result.delivery_date, result.expires_on])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new Error("Choose valid dates.");
  const { total } = quoteTotals(result);
  if (total > 1000000000 || result.advance_paise > total)
    throw new Error("Advance must not exceed the quote total.");
  return result;
}
export function offerStatus(status: string, raw: unknown) {
  const expiry = briefText(raw, "expires_on");
  return status === "sent" &&
    expiry &&
    expiry < new Date().toISOString().slice(0, 10)
    ? "expired"
    : status;
}
