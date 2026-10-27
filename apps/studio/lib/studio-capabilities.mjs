export const studioApprovalRules = [
  {
    change: "Boutique registration and business documents",
    approval: "Admin approval required",
    effect: "Your boutique stays private until verification is approved.",
  },
  {
    change: "Public name, city, introduction, story and cover",
    approval: "No repeat approval after verification",
    effect:
      "Saved edits appear on your live customer page. Pending boutiques remain private.",
  },
  {
    change: "Services, specialties, availability, starting price and lead time",
    approval: "No repeat approval",
    effect:
      "These are customer-facing preferences, not a quotation or guaranteed booking.",
  },
  {
    change: "Portfolio images, designs, prices and visibility",
    approval: "Owner/member controls publishing",
    effect:
      "Only published designs of a verified, public boutique appear to customers.",
  },
  {
    change: "Your account display name and contact phone",
    approval: "No admin approval",
    effect:
      "Updates your account, not your verified legal business information.",
  },
  {
    change:
      "Approved legal identity, verification documents, ownership or public handle",
    approval: "Contact FADEN for review",
    effect: "These are not editable through the public storefront editor.",
  },
];

export function studioVisibility(status, published) {
  if (status === "verified" && published)
    return { label: "Visible to customers", live: true };
  if (status === "suspended")
    return { label: "Suspended — contact FADEN", live: false };
  if (status === "rejected")
    return { label: "Not approved — review the feedback", live: false };
  if (status === "verified")
    return {
      label: "Verified but currently hidden — contact FADEN",
      live: false,
    };
  return { label: "Private — complete business verification", live: false };
}
