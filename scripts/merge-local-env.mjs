// Update local Supabase connection values without discarding integration credentials.
export function mergeLocalEnv(existing, defaults) {
  const replace = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "DATABASE_URL",
  ]);
  const values = new Map(
    defaults
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line];
      }),
  );
  const seen = new Set();
  const lines = existing.split(/\r?\n/).map((line) => {
    const key = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
    )?.[1];
    if (!key) return line;
    seen.add(key);
    return replace.has(key) && values.has(key) ? values.get(key) : line;
  });
  for (const [key, line] of values) if (!seen.has(key)) lines.push(line);
  return lines.join("\n").replace(/\n*$/, "\n");
}
