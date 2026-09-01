import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

const environment = getLocalSupabaseEnvironment();
const apiUrl = requireLocalValue(environment, "API_URL");
const publishableKey = requireLocalValue(
  environment,
  "PUBLISHABLE_KEY",
  "ANON_KEY",
);

async function request(path, { accessToken, body, method = "GET" } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  return { ok: response.ok, result, status: response.status };
}

async function signIn(email, password) {
  const { ok, result } = await request("/auth/v1/token?grant_type=password", {
    body: { email, password },
    method: "POST",
  });
  if (!ok || !result.access_token)
    throw new Error(`Could not sign in ${email}.`);
  return result.access_token;
}

const publicDesigns = await request(
  "/rest/v1/designs?select=id,slug,status&order=slug",
);
if (!publicDesigns.ok || publicDesigns.result.length !== 4) {
  throw new Error(
    "Anonymous catalog did not return exactly four published designs.",
  );
}
if (publicDesigns.result.some((design) => design.status !== "published")) {
  throw new Error("Anonymous catalog exposed a non-published design.");
}

const ownerToken = await signIn("owner@faden.local", "FadenOwner!2026");
const ownerDrafts = await request(
  "/rest/v1/designs?select=id,slug,status&slug=eq.aarya-crimson-silk-saree",
  { accessToken: ownerToken },
);
if (!ownerDrafts.ok || ownerDrafts.result[0]?.status !== "draft") {
  throw new Error("Boutique owner could not read their protected draft.");
}

const customerToken = await signIn(
  "customer@faden.local",
  "FadenCustomer!2026",
);
const protectedDesignId = publicDesigns.result[0].id;
const forbiddenUpdate = await request(
  `/rest/v1/designs?id=eq.${protectedDesignId}`,
  {
    accessToken: customerToken,
    body: { title: "Unauthorized title" },
    method: "PATCH",
  },
);
if (!forbiddenUpdate.ok || forbiddenUpdate.result.length !== 0) {
  throw new Error("Customer catalog-write protection failed.");
}

const customerProfile = await request("/rest/v1/profiles?select=id", {
  accessToken: customerToken,
});
const userId = customerProfile.result[0]?.id;
if (!userId) throw new Error("Customer profile could not be loaded.");

const saveResult = await request("/rest/v1/saved_designs", {
  accessToken: customerToken,
  body: { design_id: protectedDesignId, user_id: userId },
  method: "POST",
});
if (!saveResult.ok || saveResult.result.length !== 1) {
  throw new Error("Customer could not save a published design.");
}
await request(
  `/rest/v1/saved_designs?user_id=eq.${userId}&design_id=eq.${protectedDesignId}`,
  { accessToken: customerToken, method: "DELETE" },
);

console.log(
  "Public catalog, owner drafts, customer write protection, and saved designs passed.",
);
