import { createHash, timingSafeEqual } from "node:crypto";
import { getShippingReadiness } from "@faden/integrations";

const DEFAULT_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const REQUEST_TIMEOUT_MS = 10_000;

function required(value, name) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is not configured.`);
  return value.trim();
}

function booleanFlag(value) {
  return value === "true";
}

export function getShiprocketReadiness(env = process.env) {
  const readiness = getShippingReadiness(env);
  return {
    provider: readiness.provider,
    configured: readiness.configured,
    apiEnabled: booleanFlag(env.SHIPROCKET_API_ENABLED),
    liveBookingEnabled: readiness.live,
    missing: readiness.missing,
  };
}

export function shiprocketConfiguration(env = process.env) {
  const readiness = getShiprocketReadiness(env);
  if (!readiness.configured)
    throw new Error("Shiprocket credentials are not configured.");
  return {
    baseUrl: (env.SHIPROCKET_API_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    ),
    email: required(env.SHIPROCKET_API_EMAIL, "SHIPROCKET_API_EMAIL"),
    password: required(env.SHIPROCKET_API_PASSWORD, "SHIPROCKET_API_PASSWORD"),
    pickupLocation: required(
      env.SHIPROCKET_PICKUP_LOCATION,
      "SHIPROCKET_PICKUP_LOCATION",
    ),
    pickupPostcode: normalizePostcode(env.SHIPROCKET_PICKUP_POSTCODE),
    webhookSecret: required(
      env.SHIPROCKET_WEBHOOK_SECRET,
      "SHIPROCKET_WEBHOOK_SECRET",
    ),
  };
}

export function normalizePostcode(value) {
  const postcode = String(value ?? "").trim();
  if (!/^[1-9][0-9]{5}$/.test(postcode))
    throw new Error("A valid six-digit Indian PIN code is required.");
  return postcode;
}

export function normalizeParcel(value) {
  if (!value || typeof value !== "object")
    throw new Error("Parcel dimensions are required.");
  const result = {};
  for (const key of ["weight", "length", "breadth", "height"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number <= 0 || number > 500)
      throw new Error("Enter valid parcel weight and dimensions.");
    result[key] = Math.round((number + Number.EPSILON) * 100) / 100;
  }
  return result;
}

export function shippingRequestKey(orderId, operation, revision) {
  return createHash("sha256")
    .update(`${orderId}:${operation}:${revision}`)
    .digest("hex");
}

export function mapShiprocketStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (/delivered/.test(normalized) && !/undelivered/.test(normalized))
    return "delivered";
  if (/out for delivery/.test(normalized)) return "out_for_delivery";
  if (/rto|return to origin/.test(normalized)) return "rto";
  if (/in transit|shipped|reached|departed/.test(normalized))
    return "in_transit";
  if (/pickup scheduled|pickup generated|ready to ship/.test(normalized))
    return "pickup_scheduled";
  if (/awb|new|manifest/.test(normalized)) return "ready_to_ship";
  if (/cancel/.test(normalized)) return "cancelled";
  if (/undelivered|exception|lost|damaged|delay|failed/.test(normalized))
    return "exception";
  return "unknown";
}

export function verifyShiprocketWebhookToken(value, secret) {
  if (typeof value !== "string" || typeof secret !== "string") return false;
  const received = Buffer.from(value);
  const expected = Buffer.from(secret);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

async function jsonRequest(url, options, fetcher) {
  const response = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      `Shiprocket request failed with status ${response.status}.`,
    );
  if (!body || typeof body !== "object")
    throw new Error("Shiprocket returned an invalid response.");
  return body;
}

export function createShiprocketClient(config, fetcher = fetch) {
  let token;
  let tokenExpiresAt = 0;

  async function authenticate() {
    if (token && Date.now() < tokenExpiresAt) return token;
    const body = await jsonRequest(
      `${config.baseUrl}/auth/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: config.email,
          password: config.password,
        }),
      },
      fetcher,
    );
    token = required(body.token, "Shiprocket authentication token");
    tokenExpiresAt = Date.now() + 9 * 60 * 60 * 1000;
    return token;
  }

  async function request(path, options = {}) {
    const accessToken = await authenticate();
    return jsonRequest(
      `${config.baseUrl}${path}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
      },
      fetcher,
    );
  }

  return {
    async serviceability({ deliveryPostcode, parcel, cod = false }) {
      const dimensions = normalizeParcel(parcel);
      const query = new URLSearchParams({
        pickup_postcode: config.pickupPostcode,
        delivery_postcode: normalizePostcode(deliveryPostcode),
        weight: String(dimensions.weight),
        cod: cod ? "1" : "0",
      });
      return request(`/courier/serviceability/?${query}`);
    },
    createOrder(payload) {
      return request("/orders/create/adhoc", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    assignAwb(shipmentId, courierId) {
      return request("/courier/assign/awb", {
        method: "POST",
        body: JSON.stringify({
          shipment_id: shipmentId,
          courier_id: courierId,
        }),
      });
    },
    schedulePickup(shipmentId) {
      return request("/courier/generate/pickup", {
        method: "POST",
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
    },
    trackAwb(awb) {
      return request(`/courier/track/awb/${encodeURIComponent(awb)}`);
    },
    generateLabel(shipmentId) {
      return request("/courier/generate/label", {
        method: "POST",
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
    },
    generateManifest(shipmentId) {
      return request("/manifests/generate", {
        method: "POST",
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
    },
  };
}
