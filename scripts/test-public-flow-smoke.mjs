import assert from "node:assert/strict";

// Read-only production smoke checks: no cookies, account creation or provider calls.
if (!process.argv.includes("--live"))
  throw new Error(
    "Pass --live to run anonymous read checks against FADEN production.",
  );
const publicPaths = [
  "/",
  "/discover?type=boutiques",
  "/discover?type=designs",
  "/discover?type=materials",
  "/boutiques/studio-vanya",
  "/help",
  "/contact",
  "/style-assistance",
  "/terms",
  "/privacy",
  "/shipping-policy",
  "/refund-policy",
  "/cancellation-policy",
  "/measurement-privacy",
  "/auth/forgot-password",
];
let passed = 0;
async function check(host, path, allowed, verify) {
  const response = await fetch(`https://${host}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.ok(
    allowed.includes(response.status),
    `${host}${path}: HTTP ${response.status}`,
  );
  if (verify) await verify(response);
  passed++;
  console.log(`PASS ${host}${path} (${response.status})`);
}
for (const path of publicPaths)
  await check("faden.in", path, [200], async (r) => {
    const body = await r.text();
    assert.ok(
      !body.includes("Application error: a server-side exception"),
      `Server exception in ${path}`,
    );
  });
await check("faden.in", "/designs", [307], async (r) => {
  const destination = new URL(r.headers.get("location"), "https://faden.in");
  assert.equal(destination.hostname, "faden.in");
  assert.equal(destination.pathname, "/discover");
  assert.equal(destination.searchParams.get("type"), "designs");
});
for (const [host, paths] of [
  ["faden.in", ["/account", "/saved", "/requests", "/orders"]],
  [
    "studio.faden.in",
    [
      "/",
      "/onboarding",
      "/account",
      "/verification",
      "/storefront",
      "/portfolio",
      "/orders",
    ],
  ],
  ["admin.faden.in", ["/", "/boutiques", "/orders", "/deliveries"]],
]) {
  for (const path of paths)
    await check(host, path, [302, 303, 307, 308], async (r) => {
      assert.equal(
        new URL(r.headers.get("location"), `https://${host}`).pathname,
        "/auth/sign-in",
      );
    });
}
for (const host of ["faden.in", "studio.faden.in", "admin.faden.in"])
  await check(
    host,
    "/auth/callback?error=access_denied&next=%2F%2Fevil.invalid",
    [307],
    async (r) => {
      const target = new URL(r.headers.get("location"));
      assert.equal(target.hostname, host);
      assert.equal(target.pathname, "/auth/sign-in");
      assert.equal(
        target.searchParams.get("auth_error"),
        "oauth_callback_failed",
      );
    },
  );
await check("faden.in", "/boutiques/dcedf", [404]);
await check("faden.in", "/discover?type=boutiques", [200], async (r) => {
  const body = await r.text();
  assert.ok(body.includes("/boutiques/studio-vanya"));
  assert.ok(!body.includes("/boutiques/dcedf"));
});
console.log(
  `${passed} anonymous smoke checks passed. This does not verify signed-in mutations or provider delivery.`,
);
