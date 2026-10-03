import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Refund Policy" updated="Draft">
      <h2>Refund review</h2>
      <p>
        Refund eligibility is reviewed case by case against the accepted order
        and approved policy. A refund request does not mean a refund has been
        approved.
      </p>
      <h2>Payment confirmation</h2>
      <p>
        When a refund is approved, its status remains pending until the payment
        provider confirms the transaction.
      </p>
      <p>Use order support to request a review.</p>
    </LegalPage>
  );
}
