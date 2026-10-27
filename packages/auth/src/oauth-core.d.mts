export function safeNextPath(value: unknown, fallback?: string): string;
export function oauthCallbackDestination(
  parameters: URLSearchParams,
  exchange: (
    code: string,
  ) => Promise<{ error: unknown; data?: { session?: unknown } | null }>,
  fallback: string,
): Promise<string>;
