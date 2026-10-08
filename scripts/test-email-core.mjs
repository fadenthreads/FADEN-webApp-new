import assert from "node:assert/strict";
import test from "node:test";
import { emailTemplate } from "../packages/server/src/email.mjs";

test("transactional templates are allowlisted and contain only a secure order link", () => {
  const template = emailTemplate(
    "manual_shipment.updated",
    { order_id: "abc-123", address: "must not render" },
    "https://faden.in/",
  );
  assert.equal(template.subject, "Your FADEN shipment has an update");
  assert.match(template.text, /https:\/\/faden\.in\/orders\/abc-123/);
  assert.doesNotMatch(template.html, /must not render/);
  assert.equal(emailTemplate("unknown", {}, "https://faden.in"), null);
  assert.match(
    emailTemplate(
      "request.shared",
      { share_id: "share-1" },
      "https://studio.faden.in",
    ).text,
    /studio\.faden\.in/,
  );
  assert.match(
    emailTemplate("verification_approved", {}, "https://studio.faden.in")
      .subject,
    /approved/i,
  );
  assert.match(
    emailTemplate("outfit_request.submitted", {}, "https://faden.in").subject,
    /received/i,
  );
});
