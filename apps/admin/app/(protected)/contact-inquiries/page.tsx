import { requireAdminSession } from "../../../lib/admin-session";
import { ContactInquiryList } from "./contact-inquiry-list";

export default async function ContactInquiriesPage() {
  const { supabase } = await requireAdminSession();
  const { data, error } = await supabase.rpc("admin_list_contact_inquiries", {
    p_limit: 100,
  });
  if (error) {
    return (
      <div className="admin-overview-error">
        Unable to load contact enquiries.
      </div>
    );
  }
  return <ContactInquiryList inquiries={(data ?? []) as never[]} />;
}
