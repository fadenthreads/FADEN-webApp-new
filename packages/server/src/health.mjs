const DEFAULT_TIMEOUT_MS = 4_000;

export async function checkSupabaseHealth(
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { ok: false, latencyMs: 0, reason: "not_configured" };
  }

  const started = Date.now();
  try {
    const response = await fetchImpl(
      `${url.replace(/\/$/, "")}/rest/v1/boutiques?select=id&limit=1`,
      {
        method: "GET",
        headers: { apikey: key, authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    return {
      ok: response.ok,
      latencyMs: Date.now() - started,
      reason: response.ok ? undefined : "unavailable",
    };
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      reason: "unavailable",
    };
  }
}
