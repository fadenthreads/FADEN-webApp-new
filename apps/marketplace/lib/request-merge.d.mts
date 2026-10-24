export function mergeRequestDraft<T extends object>(
  base: T,
  local: T,
  remote: T,
): { merged: T; conflicts: string[] };
export function createRequestQueue(): <T>(task: () => Promise<T>) => Promise<T>;
