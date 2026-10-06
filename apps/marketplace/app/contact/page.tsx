import { LegalPage } from "../../components/legal-page";
import { ContactForm } from "../../components/contact-form";
export default function Page() {
  return (
    <LegalPage title="Contact FADEN" updated="6 October 2026">
      <h2>Customer support</h2>
      <p>
        For an existing order, use the support option on that order so the team
        can see the correct context.
      </p>
      <h2>General enquiries</h2>
      <p>
        Email <a href="mailto:fadenthreads@gmail.com">fadenthreads@gmail.com</a>{" "}
        or send the form below. We normally respond within two business days.
      </p>
      <ContactForm />
    </LegalPage>
  );
}
