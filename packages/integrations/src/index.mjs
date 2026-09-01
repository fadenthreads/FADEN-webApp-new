const DEFAULT_DAILY_BASE_URL = "https://api.daily.co/v1";
const REQUEST_TIMEOUT_MS = 10_000;

export {
  getDailyReadiness,
  getEmailReadiness,
  getLiveWorkflowsReadiness,
  getMapsReadiness,
  getPaymentsReadiness,
  getShippingReadiness,
  isPreviewMutationAllowed,
  toPublicReadiness,
} from "./readiness.mjs";

import { getDailyReadiness } from "./readiness.mjs";

function required(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is not configured.`);
  return value.trim();
}

export function dailyConfiguration(env = process.env) {
  if (!getDailyReadiness(env).configured)
    throw new Error("Daily credentials are not configured.");
  return {
    apiKey: required(env.DAILY_API_KEY, "DAILY_API_KEY"),
    baseUrl: (env.DAILY_API_BASE_URL || DEFAULT_DAILY_BASE_URL).replace(
      /\/$/,
      "",
    ),
  };
}

export function normalizeRoomName(appointmentId) {
  const id = String(appointmentId ?? "")
    .trim()
    .toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id,
    )
  )
    throw new Error("A valid appointment ID is required.");
  return `faden-${id.replaceAll("-", "")}`;
}

export function sessionWindow(startsAt, endsAt) {
  const starts = Date.parse(startsAt);
  const ends = Date.parse(endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts)
    throw new Error("A valid session window is required.");
  if (ends - starts > 2 * 60 * 60 * 1000)
    throw new Error("Session window is too long.");
  return {
    nbf: Math.floor((starts - 15 * 60 * 1000) / 1000),
    exp: Math.floor((ends + 30 * 60 * 1000) / 1000),
  };
}

async function jsonRequest(
  config,
  path,
  options,
  fetcher,
  allowNotFound = false,
) {
  const response = await fetcher(`${config.baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Daily request failed with status ${response.status}.`);
  if (!body || typeof body !== "object")
    throw new Error("Daily returned an invalid response.");
  return body;
}

export function createDailyClient(config, fetcher = fetch) {
  const client = {
    getRoom(appointmentId) {
      return jsonRequest(
        config,
        `/rooms/${encodeURIComponent(normalizeRoomName(appointmentId))}`,
        { method: "GET" },
        fetcher,
        true,
      );
    },
    createPrivateRoom({ appointmentId, startsAt, endsAt }) {
      const window = sessionWindow(startsAt, endsAt);
      return jsonRequest(
        config,
        "/rooms",
        {
          method: "POST",
          body: JSON.stringify({
            name: normalizeRoomName(appointmentId),
            privacy: "private",
            properties: {
              nbf: window.nbf,
              exp: window.exp,
              start_video_off: true,
              start_audio_off: true,
            },
          }),
        },
        fetcher,
      );
    },
    createMeetingToken({
      appointmentId,
      startsAt,
      endsAt,
      userId,
      userName,
      isOwner = false,
    }) {
      const window = sessionWindow(startsAt, endsAt);
      return jsonRequest(
        config,
        "/meeting-tokens",
        {
          method: "POST",
          body: JSON.stringify({
            properties: {
              room_name: normalizeRoomName(appointmentId),
              user_id: required(userId, "Participant ID"),
              user_name: required(userName, "Participant name").slice(0, 80),
              is_owner: Boolean(isOwner),
              nbf: window.nbf,
              exp: window.exp,
              eject_at_token_exp: true,
              start_video_off: true,
              start_audio_off: true,
            },
          }),
        },
        fetcher,
      );
    },
    deleteRoom(appointmentId) {
      return jsonRequest(
        config,
        `/rooms/${encodeURIComponent(normalizeRoomName(appointmentId))}`,
        { method: "DELETE" },
        fetcher,
      );
    },
  };
  return {
    ...client,
    async ensurePrivateRoom(input) {
      const existing = await client.getRoom(input.appointmentId);
      if (existing) return existing;
      try {
        return await client.createPrivateRoom(input);
      } catch {
        const raced = await client.getRoom(input.appointmentId);
        if (raced) return raced;
        throw new Error("Daily room could not be prepared.");
      }
    },
  };
}
