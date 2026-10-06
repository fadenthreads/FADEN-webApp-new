import { LegalPage } from "../../components/legal-page";
export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="6 October 2026">
      <h2>Information we use</h2>
      <p>
        FADEN uses account, order, address, measurement, conversation and
        support information to provide the marketplace service.
      </p>
      <h2>Private information</h2>
      <p>
        Measurements, addresses and private files are restricted to the people
        and services needed to fulfil an order. They are not public catalogue
        content.
      </p>
      <h2>How information is used</h2>
      <p>
        We use information to operate accounts, match requests with boutiques,
        process payments, coordinate appointments and delivery, prevent abuse,
        provide support and meet legal obligations. We do not sell personal
        information.
      </p>
      <h2>Service providers and retention</h2>
      <p>
        We use vetted providers for hosting, authentication, payments, email,
        maps and video sessions. Information is retained only as long as needed
        for the service, disputes, fraud prevention and applicable financial or
        legal requirements.
      </p>
      <h2>Your choices</h2>
      <p>
        You may request access, correction or deletion using the contact page.
        Some order and payment records may need to be retained where required by
        law. Privacy enquiries can also be sent to{" "}
        <a href="mailto:fadenthreads@gmail.com">fadenthreads@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
