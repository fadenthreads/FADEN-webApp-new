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

async function authRequest(path, body) {
  const response = await fetch(`${apiUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      `${path} failed (${response.status}): ${result.message ?? result.msg ?? "unknown error"}`,
    );
  }
  return result;
}

const passwordSession = await authRequest("token?grant_type=password", {
  email: "customer@faden.local",
  password: "FadenCustomer!2026",
});
if (!passwordSession.access_token || !passwordSession.user?.id) {
  throw new Error("Email/password login did not return a session.");
}

await authRequest("otp", { phone: "+919999999999" });
const phoneSession = await authRequest("verify", {
  phone: "+919999999999",
  token: "123456",
  type: "sms",
});
if (!phoneSession.access_token) {
  throw new Error("Phone OTP verification did not return a session.");
}

const escalationAttempt = await fetch(
  `${apiUrl}/rest/v1/profiles?id=eq.${passwordSession.user.id}`,
  {
    method: "PATCH",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${passwordSession.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ role: "admin" }),
  },
);
if (escalationAttempt.ok) {
  throw new Error(
    "Role-escalation protection failed: direct role update succeeded.",
  );
}

console.log("Email login, phone OTP, and role-escalation protection passed.");
