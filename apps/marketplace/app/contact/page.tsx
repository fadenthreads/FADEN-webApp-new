import { LegalPage } from "../../components/legal-page";
import { ContactForm } from "../../components/contact-form";
import { fadenContact } from "@faden/ui";
export default function Page() {
  return (
    <LegalPage title="Contact FADEN" updated="24 October 2026">
      <h2>Customer support</h2>
      <address style={{ fontStyle: "normal" }}>
        <p>{fadenContact.name} · FADEN customer care</p>
        <p>
          Phone: <a href={fadenContact.phoneHref}>{fadenContact.phone}</a>
        </p>
        <p>
          Email:{" "}
          <a href={`mailto:${fadenContact.email}`}>{fadenContact.email}</a>
        </p>
      </address>
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
