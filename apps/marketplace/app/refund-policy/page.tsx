import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Refund Policy" updated="6 October 2026">
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
      <h2>Custom garments</h2>
      <p>
        Because garments are made to individual requirements, change-of-mind
        refunds may not be available once approved work or material procurement
        has started. This does not affect remedies for defective, misdescribed
        or undelivered goods available under applicable law.
      </p>
      <h2>How to request a review</h2>
      <p>
        Open support from the relevant order and include the issue and requested
        resolution. We may ask for photographs or other information needed to
        review the request with the boutique.
      </p>
      <p>Use order support to request a review.</p>
    </LegalPage>
  );
}
