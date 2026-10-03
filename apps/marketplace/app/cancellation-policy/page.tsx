import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Cancellation Policy" updated="Draft">
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
    </LegalPage>
  );
}
