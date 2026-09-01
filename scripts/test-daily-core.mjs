import assert from "node:assert/strict";
import test from "node:test";
import {
  createDailyClient,
  getDailyReadiness,
  normalizeRoomName,
  sessionWindow,
} from "../packages/integrations/src/index.mjs";

const appointmentId = "01990c90-7d6a-7d22-8c2f-89c209b55f01";
const startsAt = "2026-09-02T10:00:00.000Z";
const endsAt = "2026-09-02T11:00:00.000Z";

test("video calls remain disabled without credentials", () => {
  const readiness = getDailyReadiness({});
  assert.equal(readiness.configured, false);
  assert.equal(readiness.live, false);
});

test("live rooms need credentials, both flags and live workflows", () => {
  const configured = {
    DAILY_API_KEY: "server-secret",
    DAILY_API_ENABLED: "true",
    DAILY_LIVE_ROOMS_ENABLED: "true",
  };
  assert.equal(getDailyReadiness(configured).live, false);
  assert.equal(
    getDailyReadiness({
      ...configured,
      FADEN_ENABLE_LIVE_WORKFLOWS: "true",
    }).live,
    true,
  );
});

test("room names are deterministic and contain no customer data", () => {
  assert.equal(
    normalizeRoomName(appointmentId),
    "faden-01990c907d6a7d228c2f89c209b55f01",
  );
  assert.throws(() => normalizeRoomName("customer@example.com"));
});

test("session access has a bounded grace window", () => {
  const window = sessionWindow(startsAt, endsAt);
  assert.equal(window.nbf, Date.parse(startsAt) / 1000 - 15 * 60);
  assert.equal(window.exp, Date.parse(endsAt) / 1000 + 30 * 60);
  assert.throws(() => sessionWindow(endsAt, startsAt));
  assert.throws(() => sessionWindow(startsAt, "2026-09-02T13:00:01.000Z"));
});

test("client creates private non-recorded rooms and participant-bound tokens", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = createDailyClient(
    { apiKey: "server-secret", baseUrl: "https://example.test/v1" },
    fetcher,
  );
  await client.createPrivateRoom({ appointmentId, startsAt, endsAt });
  await client.createMeetingToken({
    appointmentId,
    startsAt,
    endsAt,
    userId: "user-1",
    userName: "Customer",
  });
  const room = JSON.parse(calls[0].init.body);
  const token = JSON.parse(calls[1].init.body);
  assert.equal(room.privacy, "private");
  assert.equal("enable_recording" in room.properties, false);
  assert.equal(token.properties.room_name, room.name);
  assert.equal("enable_recording" in token.properties, false);
  assert.equal(token.properties.eject_at_token_exp, true);
  assert.equal(calls[0].init.headers.Authorization, "Bearer server-secret");
});

test("room provisioning reuses an existing deterministic room", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        name: normalizeRoomName(appointmentId),
        url: "https://faden.daily.co/existing",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  const client = createDailyClient(
    { apiKey: "server-secret", baseUrl: "https://example.test/v1" },
    fetcher,
  );
  const room = await client.ensurePrivateRoom({
    appointmentId,
    startsAt,
    endsAt,
  });
  assert.equal(room.url, "https://faden.daily.co/existing");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "GET");
});
