import Link from "next/link";
import { MarketplaceHeader } from "../../../../components/marketplace-header";
import { customerOrder } from "../../../../lib/orders";
import { SupportForm } from "./support-form";
export default async function SupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await customerOrder(id);
  return (
    <div className="market-page offer-page">
      <MarketplaceHeader active="atelier" />
      <main className="offer-main">
        <Link className="offer-kicker" href={`/orders/${id}`}>
          ← Order
        </Link>
        <h1>Order support</h1>
        <p className="offer-lead">
          Ask for help, cancellation review, or a refund review. A refund is
          never confirmed until the payment provider confirms it.
        </p>
        <SupportForm orderId={id} />
      </main>
    </div>
  );
}
