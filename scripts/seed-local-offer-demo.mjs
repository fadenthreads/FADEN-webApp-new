import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";
const env = getLocalSupabaseEnvironment(),
  api = requireLocalValue(env, "API_URL");
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(api).hostname),
  "Demo is local-only",
);
class DisabledRealtimeTransport {}
const options = {
  realtime: { transport: DisabledRealtimeTransport },
  auth: { persistSession: false, autoRefreshToken: false },
};
const admin = createClient(
  api,
  requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
  options,
);
const anon = requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY");
const { data: users, error: userError } = await admin.auth.admin.listUsers({
  perPage: 1000,
});
assert.equal(userError, null);
const customer = users.users.find((u) => u.email === "customer@faden.local");
assert.ok(customer, "Run seed:auth first");
async function signed(email, password) {
  const client = createClient(api, anon, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null);
  return client;
}
const customerClient = await signed(
  "customer@faden.local",
  "FadenCustomer!2026",
);
const demoNote =
  "LOCAL DEMO · A fictional occasionwear brief for reviewing the FADEN offer screens. No real customer measurements, order or payment.";
const { data: existing } = await admin
  .from("outfit_requests")
  .select("id")
  .eq("user_id", customer.id)
  .contains("draft", { notes: demoNote })
  .limit(1)
  .maybeSingle();
if (existing) {
  console.log(
    `Existing local demo: http://localhost:3000/offers?request=${existing.id}`,
  );
  process.exit(0);
}
const dates = (days) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const created = await customerClient
  .from("outfit_requests")
  .insert({ user_id: customer.id })
  .select()
  .single();
assert.equal(created.error, null);
const requestId = created.data.id;
const draft = {
  occasion: "Reception",
  garment: "Lehenga",
  notes: demoNote,
  expert: true,
  colors: ["Terracotta Earth", "Alabaster Ivory"],
  fabrics: ["Fluid & Silky"],
  silhouette: "Flowing A-Line",
  measurementMethod: "later",
  budget: "25k_50k",
  deliveryDate: dates(50),
  eventDate: dates(60),
  consent: true,
};
const saved = await customerClient
  .from("outfit_requests")
  .update({ draft })
  .eq("id", requestId)
  .select()
  .single();
assert.equal(saved.error, null);
assert.equal(
  (
    await customerClient.rpc("submit_outfit_request", {
      request_id: requestId,
      expected_version: saved.data.version,
    })
  ).error,
  null,
);
const demos = [
  {
    email: "demo-atelier-one@faden.local",
    slug: "faden-demo-atelier-one",
    name: "Demo · Terracotta Atelier",
    city: "Hyderabad",
    price: 3200000,
    days: 40,
    description:
      "Silk ensemble with hand-finished details and two fitting sessions.",
  },
  {
    email: "demo-atelier-two@faden.local",
    slug: "faden-demo-atelier-two",
    name: "Demo · Ivory Studio",
    city: "Bengaluru",
    price: 3800000,
    days: 45,
    description:
      "A structured silhouette with detailed embroidery and three fitting sessions.",
  },
];
const { data: reference } = await admin
  .from("boutique_profiles")
  .select("hero_image_url")
  .not("hero_image_url", "is", null)
  .limit(2);
for (const [index, demo] of demos.entries()) {
  let user = users.users.find((u) => u.email === demo.email);
  if (user) {
    assert.equal(
      user.user_metadata.faden_offer_demo,
      true,
      "Refusing to repurpose an existing account",
    );
  } else {
    const result = await admin.auth.admin.createUser({
      email: demo.email,
      password: "FadenDemo!2026",
      email_confirm: true,
      user_metadata: { full_name: demo.name, faden_offer_demo: true },
    });
    assert.equal(result.error, null);
    user = result.data.user;
  }
  assert.equal(
    (
      await admin
        .from("profiles")
        .update({ role: "boutique_owner" })
        .eq("id", user.id)
    ).error,
    null,
  );
  const { data: existingBoutique } = await admin
    .from("boutiques")
    .select("id,owner_id")
    .eq("slug", demo.slug)
    .maybeSingle();
  if (existingBoutique)
    assert.equal(
      existingBoutique.owner_id,
      user.id,
      "Demo slug is already owned by another account",
    );
  let boutique = existingBoutique;
  if (!boutique) {
    const result = await admin
      .from("boutiques")
      .insert({
        owner_id: user.id,
        slug: demo.slug,
        name: demo.name,
        city: demo.city,
        description:
          "LOCAL DEMO · Fictional boutique for development review only.",
        status: "verified",
        is_published: true,
      })
      .select("id")
      .single();
    assert.equal(result.error, null);
    boutique = result.data;
  }
  assert.equal(
    (
      await admin.from("boutique_members").upsert({
        boutique_id: boutique.id,
        user_id: user.id,
        role: "boutique_owner",
      })
    ).error,
    null,
  );
  assert.equal(
    (
      await admin.from("boutique_profiles").upsert({
        boutique_id: boutique.id,
        hero_image_url: reference?.[index]?.hero_image_url ?? null,
        story:
          "Fictional local demo boutique. Photography is illustrative, not a customer proposal.",
      })
    ).error,
    null,
  );
  const share = await customerClient.rpc("share_outfit_request", {
    target_request: requestId,
    target_boutique: boutique.id,
    measurements_allowed: false,
    inspiration_allowed: false,
    confirmed: true,
  });
  assert.equal(share.error, null);
  const owner = await signed(demo.email, "FadenDemo!2026");
  const offer = await owner.rpc("save_boutique_offer", {
    target_share: share.data,
    expected_version: 0,
    proposal: {
      title: "LOCAL DEMO · Reception Lehenga",
      items: [
        {
          label: "Bespoke ensemble",
          detail: demo.description,
          quantity: 1,
          unit_paise: demo.price,
        },
        {
          label: "Delivery",
          detail: "Included in this illustrative quote",
          quantity: 1,
          unit_paise: 0,
        },
      ],
      tax_bps: 0,
      advance_paise: 1000000,
      delivery_date: dates(demo.days),
      expires_on: dates(14),
      terms: `LOCAL DEMO ONLY. ${demo.description} Delivery is included. No order or payment is being booked; tax shown is illustrative, not tax advice.`,
    },
    send_now: true,
  });
  assert.equal(offer.error, null);
}
console.log(
  `Local demo ready: http://localhost:3000/offers?request=${requestId}`,
);
console.log(
  "Two fictional demo boutiques and quotes were added. Existing customer drafts and Aarya onboarding were preserved.",
);
