import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Cancellation Policy" updated="6 October 2026">
      <h2>Before checkout</h2>
      <p>
        Unpaid orders can be cancelled before checkout begins. Accepted offers
        remain part of the order history.
      </p>
      <h2>After checkout</h2>
      <p>
        For a paid or in-progress order, submit a cancellation request through
        order support. FADEN will review it; no outcome is automatic.
      </p>
      <h2>Review outcome</h2>
      <p>
        Any refund depends on the work completed, materials already procured,
        the accepted offer and applicable consumer law. We will show the final
        outcome in order support before closing the request.
      </p>
    </LegalPage>
  );
}
