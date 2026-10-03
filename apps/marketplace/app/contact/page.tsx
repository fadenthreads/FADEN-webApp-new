import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Contact FADEN" updated="Launch">
      <h2>Customer support</h2>
      <p>
        For an existing order, use the support option on that order so the team
        can see the correct context.
      </p>
      <h2>General enquiries</h2>
      <p>
        Business contact details must be approved and added here before
        production launch.
      </p>
      <p className="legal-page__notice">
        No customer-support email address is published in this draft.
      </p>
    </LegalPage>
  );
}
