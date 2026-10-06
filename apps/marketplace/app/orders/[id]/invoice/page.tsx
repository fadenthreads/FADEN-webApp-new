import Link from "next/link";
import { notFound } from "next/navigation";
import { money } from "@faden/ui";
import { PrintInvoiceButton } from "../../../../components/print-invoice-button";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export default async function Invoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await customerOrder(id);
  const db = await getSupabaseServerClient();
  const { data: payment, error } = await db
    .from("order_payment_attempts")
    .select("amount_paise,currency,mode,status,provider_payment_id,verified_at")
    .eq("order_id", id)
    .in("status", ["captured", "refund_pending", "refunded"])
    .maybeSingle();
  if (error || !payment) notFound();

  const invoiceNumber = `FAD-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const balance = Math.max(0, order.total_paise - payment.amount_paise);
  return (
    <main className="checkout-page invoice-page">
      <div className="checkout-canvas">
        <header className="checkout-header">
          <div>
            <span className="offer-kicker">FADEN · Order invoice</span>
            <h1>Invoice {invoiceNumber}</h1>
            <p>Payment receipt and accepted-order summary.</p>
          </div>
          <Link href={`/orders/${id}`}>Back to order</Link>
        </header>
        <section className="checkout-breakdown">
          <p>
            <strong>Issued:</strong>{" "}
            {new Date(
              payment.verified_at || order.accepted_at,
            ).toLocaleDateString("en-IN")}
          </p>
          <p>
            <strong>Order:</strong> {id}
          </p>
          <p>
            <strong>Boutique:</strong> {order.boutique_name}
          </p>
          <dl>
            <div>
              <dt>Order subtotal</dt>
              <dd>{money(order.subtotal_paise)}</dd>
            </div>
            <div>
              <dt>Tax shown in accepted offer</dt>
              <dd>{money(order.tax_paise)}</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd>{money(order.total_paise)}</dd>
            </div>
            <div>
              <dt>Payment received</dt>
              <dd>{money(payment.amount_paise)}</dd>
            </div>
            <div>
              <dt>Balance remaining</dt>
              <dd>{money(balance)}</dd>
            </div>
          </dl>
          <p>
            <strong>Payment reference:</strong> {payment.provider_payment_id}
          </p>
          {payment.mode === "test" && (
            <p className="legal-page__notice">
              Test-mode receipt — no real money was collected. This is not a tax
              invoice.
            </p>
          )}
          <p>
            FADEN provides the marketplace order record. The fulfilling boutique
            remains responsible for any legally required seller tax invoice.
          </p>
        </section>
        <div className="offer-actions invoice-actions">
          <PrintInvoiceButton />
        </div>
      </div>
    </main>
  );
}
