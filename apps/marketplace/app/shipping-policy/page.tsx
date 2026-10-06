import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Shipping Policy" updated="6 October 2026">
      <h2>Manual courier coordination</h2>
      <p>
        For launch, FADEN Admin coordinates courier fulfilment manually after an
        order is ready. FADEN does not claim automated carrier booking or
        instant AWB generation.
      </p>
      <h2>Tracking</h2>
      <p>
        Carrier details and tracking are added to your order after a courier has
        been arranged. Timing and delivery coverage must be confirmed for each
        order.
      </p>
      <h2>Address and receipt</h2>
      <p>
        Customers must review their delivery address before dispatch. Report
        visible parcel damage or a delivery problem through order support as
        soon as practical so the team can coordinate with the courier.
      </p>
    </LegalPage>
  );
}
