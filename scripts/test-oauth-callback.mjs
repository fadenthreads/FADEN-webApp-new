import assert from "node:assert/strict";
import { test } from "node:test";
import {
  safeNextPath,
  oauthCallbackDestination,
} from "../packages/auth/src/oauth-core.mjs";

test("redirect targets stay on the current app", () => {
  for (const value of [
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/%5cevil.invalid",
    "/%2f%2fevil.invalid",
    "/%0aevil",
    "/%zz",
    undefined,
  ])
    assert.equal(safeNextPath(value, "/account"), "/account");
  assert.equal(
    safeNextPath("/boutiques?status=pending"),
    "/boutiques?status=pending",
  );
});

test("only a successful session exchange continues to the requested page", async () => {
  for (const fallback of ["/", "/account"]) {
    let received;
    const result = await oauthCallbackDestination(
      new URLSearchParams({ code: "test-code", next: "/orders" }),
      async (code) => {
        received = code;
        return { data: { session: {} }, error: null };
      },
      fallback,
    );
    assert.equal(result, "/orders");
    assert.equal(received, "test-code");
  }
});

test("missing code and provider refusal never attempt session exchange", async () => {
  for (const parameters of [
    new URLSearchParams(),
    new URLSearchParams({
      code: "unused",
      error: "access_denied",
      error_description: "not public",
    }),
  ]) {
    const result = await oauthCallbackDestination(
      parameters,
      () => {
        throw new Error("must not exchange");
      },
      "/",
    );
    assert.equal(
      result,
      "/auth/sign-in?auth_error=oauth_callback_failed&next=%2F",
    );
    assert.ok(!result.includes("not public"));
  }
});

test("failed, empty and throwing exchanges show a retry message without leaking details", async () => {
  for (const exchange of [
    async () => ({ error: { message: "secret" } }),
    async () => ({ data: { session: null }, error: null }),
    async () => {
      throw new Error("secret");
    },
  ]) {
    const result = await oauthCallbackDestination(
      new URLSearchParams({ code: "test-code", next: "//evil.invalid" }),
      exchange,
      "/account",
    );
    assert.equal(
      result,
      "/auth/sign-in?auth_error=oauth_callback_failed&next=%2Faccount",
    );
  }
});
