import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Terms of Service" updated="6 October 2026">
      <h2>Using FADEN</h2>
      <p>
        FADEN connects customers with independent boutiques for custom fashion.
        Quotes, timing, materials and fitting terms are shown in each accepted
        offer.
      </p>
      <h2>Orders</h2>
      <p>
        Accepted offers are recorded as order snapshots. Payment, cancellation,
        delivery and aftercare arrangements are governed by the applicable order
        information and approved launch policies.
      </p>
      <h2>Accounts and acceptable use</h2>
      <p>
        Keep your account information accurate and your sign-in details secure.
        Do not misuse the service, impersonate another person, upload unlawful
        material or interfere with another customer or boutique.
      </p>
      <h2>Boutiques and custom work</h2>
      <p>
        Boutiques are independent businesses responsible for the descriptions,
        workmanship and commitments in their accepted offers. Custom work may
        vary slightly from photographs and digital previews because it is made
        by hand. Material changes to an accepted price, design or timeline must
        be agreed through the order workflow.
      </p>
      <h2>Service availability</h2>
      <p>
        We may temporarily restrict the service for maintenance, safety or
        suspected misuse. Nothing in these terms limits rights that cannot be
        limited under applicable consumer law.
      </p>
      <h2>Questions</h2>
      <p>
        Contact{" "}
        <a href="mailto:fadenthreads@gmail.com">fadenthreads@gmail.com</a>
        before placing an order if you need clarification.
      </p>
    </LegalPage>
  );
}
