export function safeNextPath(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded))
      return fallback;
    const destination = new URL(value, "https://faden.invalid");
    return destination.origin === "https://faden.invalid" ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function oauthCallbackDestination(parameters, exchange, fallback) {
  const next = safeNextPath(parameters.get("next"), fallback);
  const failure = `/auth/sign-in?auth_error=oauth_callback_failed&next=${encodeURIComponent(next)}`;
  const code = parameters.get("code");
  if (parameters.has("error") || !code) return failure;
  try {
    const result = await exchange(code);
    return result.error || !result.data?.session ? failure : next;
  } catch {
    return failure;
  }
}
