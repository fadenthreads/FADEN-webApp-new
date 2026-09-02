import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { test } from "node:test";

import { getAdminAccessRedirect } from "../apps/admin/lib/admin-shell-core.mjs";
import { getReadinessPresentation } from "../apps/admin/lib/admin-overview-core.mjs";
import {
  formatCount,
  formatCurrency,
  formatISTDateTime,
  formatTimeRange,
} from "../apps/admin/lib/format.mjs";
import {
  ADMIN_PAGE_META,
  ADMIN_PRIMARY_NAV,
  isAdminNavActive,
  isCommerceSubnavVisible,
  normalizeAdminPath,
  shouldCloseMobileMenu,
} from "../apps/admin/lib/admin-shell-core.mjs";
import {
  getLocalSupabaseEnvironment,
  requireLocalValue,
} from "./supabase-local-env.mjs";

const adminBase = process.env.FADEN_ADMIN_TEST_URL ?? "http://localhost:3002";

async function adminHealthReady() {
  try {
    const response = await fetch(new URL("/api/health", adminBase), {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.toUpperCase().replace(/=+$/u, "");
  let bits = "";
  for (const char of cleaned) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret, step = 30, digits = 6) {
  const counter = Math.floor(Date.now() / 1000 / step);
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

async function adminPage(path, cookie) {
  const response = await fetch(new URL(path, adminBase), {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
    html: response.status < 400 ? await response.text() : "",
  };
}

test("getAdminAccessRedirect enforces auth, role and AAL2", () => {
  assert.equal(
    getAdminAccessRedirect({
      authenticated: false,
      role: null,
      aal: null,
    }),
    "/auth/sign-in",
  );
  assert.equal(
    getAdminAccessRedirect({
      authenticated: true,
      role: "customer",
      aal: "aal2",
    }),
    "/auth/unauthorized",
  );
  assert.equal(
    getAdminAccessRedirect({
      authenticated: true,
      role: "admin",
      aal: "aal1",
    }),
    "/auth/mfa",
  );
  assert.equal(
    getAdminAccessRedirect({
      authenticated: true,
      role: "admin",
      aal: "aal2",
    }),
    null,
  );
});

test("admin overview formats money, counts and explicit IST labels", () => {
  assert.equal(formatCurrency(500000), "₹5,000.00");
  assert.equal(formatCount(12345), "12,345");
  assert.equal(formatTimeRange(30), "Last 30 days (IST)");
  assert.match(formatISTDateTime("2024-09-01T10:30:00Z"), /IST$/);
  assert.match(formatISTDateTime("2024-09-01T10:30:00Z"), /4:00 pm/i);
});

test("admin overview readiness presentation covers every state", () => {
  const base = {
    provider: "daily",
    configured: false,
    enabled: false,
    live: false,
  };
  assert.equal(getReadinessPresentation(base).label, "Not configured");
  assert.equal(
    getReadinessPresentation({ ...base, configured: true }).label,
    "Configured",
  );
  assert.equal(
    getReadinessPresentation({ ...base, configured: true, enabled: true })
      .label,
    "Enabled",
  );
  assert.equal(
    getReadinessPresentation({
      ...base,
      configured: true,
      enabled: true,
      live: true,
    }).label,
    "Live",
  );
});

test("admin navigation active state follows route groups", () => {
  const overview = ADMIN_PRIMARY_NAV.find((item) => item.key === "overview");
  const commerce = ADMIN_PRIMARY_NAV.find((item) => item.key === "orders");
  assert.ok(overview && commerce);

  assert.equal(isAdminNavActive("/", overview), true);
  assert.equal(isAdminNavActive("/boutiques", overview), false);
  assert.equal(isAdminNavActive("/orders", commerce), true);
  assert.equal(isAdminNavActive("/settlements", commerce), true);
  assert.equal(isCommerceSubnavVisible("/orders"), true);
  assert.equal(isCommerceSubnavVisible("/boutiques"), false);
  assert.equal(normalizeAdminPath("/orders/"), "/orders");
});

test("all required routes have page metadata", () => {
  const routes = [
    "/",
    "/boutiques",
    "/orders",
    "/disputes",
    "/settlements",
    "/audit",
    "/configuration",
  ];
  for (const route of routes) {
    assert.ok(ADMIN_PAGE_META[route], `missing metadata for ${route}`);
  }
});

test("mobile menu closes on Escape", () => {
  assert.equal(shouldCloseMobileMenu("Escape"), true);
  assert.equal(shouldCloseMobileMenu("Tab"), false);
});

test("admin shell HTTP coverage", async (t) => {
  if (!(await adminHealthReady())) {
    t.skip("Admin app is not running on " + adminBase);
    return;
  }

  const unauthenticated = await adminPage("/boutiques");
  assert.equal(unauthenticated.status, 307);
  assert.match(unauthenticated.location ?? "", /\/auth\/sign-in/);

  const env = getLocalSupabaseEnvironment();
  const url = requireLocalValue(env, "API_URL");
  assert.ok(
    ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
    "Local fixture testing only",
  );

  class DisabledRealtimeTransport {}
  const clientOptions = {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: DisabledRealtimeTransport },
  };
  const localAdmin = createClient(
    url,
    requireLocalValue(env, "SERVICE_ROLE_KEY", "SECRET_KEY"),
    clientOptions,
  );

  async function login(email, password) {
    const jar = new Map();
    const client = createServerClient(
      url,
      requireLocalValue(env, "ANON_KEY", "PUBLISHABLE_KEY"),
      {
        ...clientOptions,
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) =>
            cookies.forEach((cookie) => jar.set(cookie.name, cookie.value)),
        },
      },
    );
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    assert.equal(error, null);
    const cookie = () =>
      [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    return {
      client,
      jar,
      cookie,
      assurance: await client.auth.mfa.getAuthenticatorAssuranceLevel(),
    };
  }

  async function loginAdminAal2() {
    const users = await localAdmin.auth.admin.listUsers({ perPage: 1000 });
    assert.equal(users.error, null);
    const adminUser = users.data.users.find(
      (user) => user.email === "admin@faden.local",
    );
    assert.ok(adminUser);
    const factors = await localAdmin.auth.admin.mfa.listFactors({
      userId: adminUser.id,
    });
    assert.equal(factors.error, null);
    for (const factor of factors.data?.factors ?? []) {
      const deleted = await localAdmin.auth.admin.mfa.deleteFactor({
        userId: adminUser.id,
        id: factor.id,
      });
      assert.equal(deleted.error, null);
    }

    const session = await login("admin@faden.local", "FadenAdmin!2026");
    if (session.assurance.data?.currentLevel === "aal2") {
      return { cookie: session.cookie() };
    }

    const aal1Attempt = await adminPage("/", session.cookie());
    assert.equal(aal1Attempt.status, 307);
    assert.match(aal1Attempt.location ?? "", /\/auth\/mfa/);

    const enroll = await session.client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `A01 shell test ${crypto.randomUUID()}`,
    });
    assert.equal(enroll.error, null);
    const factorId = enroll.data.id;
    const secret = enroll.data.totp.secret;
    const challenge = await session.client.auth.mfa.challenge({ factorId });
    assert.equal(challenge.error, null);
    const verify = await session.client.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: totpCode(secret),
    });
    assert.equal(verify.error, null);

    const assurance =
      await session.client.auth.mfa.getAuthenticatorAssuranceLevel();
    assert.equal(assurance.data?.currentLevel, "aal2");
    return { cookie: session.cookie() };
  }

  const customer = await login("customer@faden.local", "FadenCustomer!2026");
  const customerAttempt = await adminPage("/orders", customer.cookie());
  assert.equal(customerAttempt.status, 307);
  assert.match(customerAttempt.location ?? "", /\/auth\/unauthorized/);

  const admin = await loginAdminAal2();

  const routes = [
    "/",
    "/boutiques",
    "/orders",
    "/disputes",
    "/settlements",
    "/audit",
    "/configuration",
  ];

  for (const route of routes) {
    const page = await adminPage(route, admin.cookie);
    assert.equal(page.status, 200, route);
    assert.match(page.html, /Skip to content/);
    assert.match(page.html, /<main[^>]+id="admin-main"/);
    assert.match(page.html, /<aside[^>]+aria-label="Admin sidebar"/);
    assert.doesNotMatch(page.html, /\$142\.5K|€ 142,500|1,842 active orders/i);
  }

  const boutiques = await adminPage("/boutiques", admin.cookie);
  assert.match(boutiques.html, /aria-current="page"/);
  assert.match(boutiques.html, /Marketplace/);

  const settlements = await adminPage("/settlements", admin.cookie);
  assert.match(settlements.html, /Settlements/);
  assert.match(settlements.html, /aria-current="page"/);

  const mobile = await adminPage("/", admin.cookie);
  assert.match(mobile.html, /aria-label="Open admin navigation menu"/);
  assert.match(mobile.html, /aria-expanded="false"/);
  assert.match(mobile.html, /aria-controls="/);
});
