import Link from "next/link";
import { redirect } from "next/navigation";
import { briefText, money } from "@faden/ui";
import { customerOrder } from "../../../lib/orders";
import { testCheckoutAvailable } from "../../../lib/payments";
import { PaymentControls } from "../../../components/payment-controls";
export default async function SecureOrder({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/orders");
  const order = await customerOrder(id);
  return (
    <main className="checkout-page">
      <div className="checkout-canvas">
        <header className="checkout-header">
          <div>
            <span className="offer-kicker">{order.boutique_name}</span>
            <h1>Secure your order</h1>
            <p>
              Your choice is saved. This checkout is for test payments only; no
              real money is collected and production is not authorized.
            </p>
          </div>
          <Link href={`/orders/${id}`}>← Return to Atelier</Link>
        </header>
        <section className="checkout-breakdown">
          <span className="offer-kicker">Payment breakdown · INR</span>
          <h2>{briefText(order.quote, "title")}</h2>
          <dl>
            <div>
              <dt>Order total</dt>
              <dd>{money(order.total_paise)}</dd>
            </div>
            <div className="checkout-advance">
              <dt>
                <strong>
                  {order.advance_paise === 0
                    ? "No advance requested"
                    : "Advance due"}
                </strong>
                <span>
                  {order.status === "test_advance_paid"
                    ? "Test capture verified — no real money"
                    : "Not collected"}
                </span>
              </dt>
              <dd>{money(order.advance_paise)}</dd>
            </div>
            <div>
              <dt>
                Remaining balance<span>Per the accepted boutique terms</span>
              </dt>
              <dd>{money(order.total_paise - order.advance_paise)}</dd>
            </div>
          </dl>
        </section>
        <section className="checkout-payment">
          <PaymentControls
            orderId={order.id}
            available={testCheckoutAvailable()}
            status={order.status}
            amount={order.advance_paise}
            webhookReady={Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)}
          />
          <div className="offer-actions">
            <Link href={`/orders/${id}`} className="offer-btn secondary">
              View order details
            </Link>
            <Link href="/orders" className="offer-btn secondary">
              My orders
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
