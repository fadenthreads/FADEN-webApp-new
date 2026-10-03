import Link from "next/link";
import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Help" updated="Launch">
      <h2>Orders and payments</h2>
      <p>
        Review the order hub for your offer, payment status, design approval and
        production updates.
      </p>
      <h2>Shipping and delivery</h2>
      <p>
        Tracking appears after FADEN Admin has manually arranged the courier.
      </p>
      <h2>Need help with an order?</h2>
      <p>
        Open the relevant order and choose <strong>Get support</strong>.
      </p>
      <Link className="offer-btn" href="/contact">
        Contact FADEN
      </Link>
    </LegalPage>
  );
}
