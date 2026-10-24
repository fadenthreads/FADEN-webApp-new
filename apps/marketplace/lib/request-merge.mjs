const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createRequestQueue() {
  let pending = Promise.resolve();
  return (task) => {
    const result = pending.catch(() => undefined).then(task);
    pending = result.catch(() => undefined);
    return result;
  };
}

/** Three-way merge: never silently overwrite a competing edit to the same field. */
export function mergeRequestDraft(base, local, remote) {
  const merged = { ...remote };
  const conflicts = [];
  for (const key of Object.keys(local)) {
    if (same(local[key], base[key])) continue;
    if (!same(remote[key], base[key]) && !same(remote[key], local[key])) {
      conflicts.push(key);
    } else merged[key] = local[key];
  }
  return { merged, conflicts };
}
