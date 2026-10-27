export function orderProgressSummary(
  updates: { stage: number; note: string | null }[] | null | undefined,
  failed: boolean,
  stages: readonly string[],
): { title: string; detail: string };
