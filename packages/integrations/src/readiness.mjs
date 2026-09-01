function booleanFlag(value) {
  return value === "true";
}

function integrationEnabled(env, ...flags) {
  return flags.every((flag) => booleanFlag(env[flag]));
}

function liveWorkflowsActive(env) {
  return booleanFlag(env.FADEN_ENABLE_LIVE_WORKFLOWS);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ missing: string[], enabled: boolean, liveWorkflows?: boolean }} input
 * @returns {{ configured: boolean, enabled: boolean, live: boolean, missing: string[] }}
 */
function buildReadiness(env, { missing, enabled, liveWorkflows = true }) {
  const configured = missing.length === 0;
  return {
    configured,
    enabled,
    live: configured && enabled && (!liveWorkflows || liveWorkflowsActive(env)),
    missing,
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getLiveWorkflowsReadiness(env = process.env) {
  const enabled = liveWorkflowsActive(env);
  return {
    configured: true,
    enabled,
    live: enabled,
    missing: [],
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function isPreviewMutationAllowed(env = process.env) {
  if (liveWorkflowsActive(env)) return false;
  return booleanFlag(env.FADEN_ALLOW_PREVIEW_MUTATIONS);
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getPaymentsReadiness(env = process.env) {
  const missing = [];
  if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
  if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");

  return {
    provider: "razorpay",
    ...buildReadiness(env, {
      missing,
      enabled: booleanFlag(env.RAZORPAY_PAYMENTS_ENABLED),
      liveWorkflows: true,
    }),
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getShippingReadiness(env = process.env) {
  const missing = [];
  if (!env.SHIPROCKET_API_EMAIL) missing.push("SHIPROCKET_API_EMAIL");
  if (!env.SHIPROCKET_API_PASSWORD) missing.push("SHIPROCKET_API_PASSWORD");
  if (!env.SHIPROCKET_PICKUP_LOCATION)
    missing.push("SHIPROCKET_PICKUP_LOCATION");
  if (!env.SHIPROCKET_PICKUP_POSTCODE)
    missing.push("SHIPROCKET_PICKUP_POSTCODE");
  if (!env.SHIPROCKET_WEBHOOK_SECRET) missing.push("SHIPROCKET_WEBHOOK_SECRET");

  return {
    provider: "shiprocket",
    ...buildReadiness(env, {
      missing,
      enabled: integrationEnabled(
        env,
        "SHIPROCKET_API_ENABLED",
        "SHIPROCKET_LIVE_BOOKING_ENABLED",
      ),
      liveWorkflows: true,
    }),
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getDailyReadiness(env = process.env) {
  const missing = [];
  if (!env.DAILY_API_KEY) missing.push("DAILY_API_KEY");

  return {
    provider: "daily",
    ...buildReadiness(env, {
      missing,
      enabled: integrationEnabled(
        env,
        "DAILY_API_ENABLED",
        "DAILY_LIVE_ROOMS_ENABLED",
      ),
      liveWorkflows: true,
    }),
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getMapsReadiness(env = process.env) {
  const missing = [];
  if (!env.GEOAPIFY_API_KEY) missing.push("GEOAPIFY_API_KEY");

  return {
    provider: "geoapify",
    ...buildReadiness(env, {
      missing,
      enabled: booleanFlag(env.MAPS_API_ENABLED),
      liveWorkflows: false,
    }),
  };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function getEmailReadiness(env = process.env) {
  const missing = [];
  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_USER) missing.push("SMTP_USER");
  if (!env.SMTP_PASSWORD) missing.push("SMTP_PASSWORD");

  return {
    provider: "smtp",
    ...buildReadiness(env, {
      missing,
      enabled: booleanFlag(env.EMAIL_DISPATCH_ENABLED),
      liveWorkflows: true,
    }),
  };
}

/**
 * Safe subset for authenticated readiness endpoints. Never includes secrets.
 * @param {{ provider: string, configured: boolean, enabled: boolean, live: boolean }} readiness
 */
export function toPublicReadiness(readiness) {
  return {
    provider: readiness.provider,
    configured: readiness.configured,
    enabled: readiness.enabled,
    live: readiness.live,
  };
}
