import Link from "next/link";
import { notFound } from "next/navigation";
import { money } from "@faden/ui";
import { customerOrder } from "../../../../lib/orders";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
export default async function Receipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    order = await customerOrder(id);
  if (order.status !== "test_advance_paid") notFound();
  const client = await getSupabaseServerClient();
  const { data: attempt } = await client
    .from("order_payment_attempts")
    .select()
    .eq("order_id", id)
    .eq("status", "captured")
    .maybeSingle();
  if (!attempt) notFound();
  return (
    <main className="checkout-page">
      <div className="checkout-canvas">
        <header className="checkout-header">
          <div>
            <span className="offer-kicker">FADEN · Sandbox</span>
            <h1>Test payment receipt</h1>
            <p>
              Not a tax invoice. No real money collected. Do not fulfil this
              test order.
            </p>
          </div>
        </header>
        <section className="checkout-breakdown">
          <h2>{order.boutique_name}</h2>
          <dl>
            <div>
              <dt>Test advance verified</dt>
              <dd>{money(attempt.amount_paise)}</dd>
            </div>
            <div>
              <dt>Uncollected balance</dt>
              <dd>{money(order.total_paise - attempt.amount_paise)}</dd>
            </div>
          </dl>
          <p className="request-reference">Order: {id}</p>
          <p className="request-reference">
            Razorpay payment: {attempt.provider_payment_id}
          </p>
          <p>
            Verified {new Date(attempt.verified_at!).toLocaleString("en-IN")}
          </p>
        </section>
        <div className="offer-actions">
          <Link className="offer-btn" href={`/orders/${id}`}>
            Return to order
          </Link>
        </div>
      </div>
    </main>
  );
}
