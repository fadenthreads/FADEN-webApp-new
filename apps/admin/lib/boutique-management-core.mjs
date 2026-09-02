export const BOUTIQUE_STATUSES = [
  "draft",
  "pending_verification",
  "verified",
  "suspended",
  "rejected",
];

export const BOUTIQUE_SORTS = [
  "created_desc",
  "created_asc",
  "updated_desc",
  "updated_asc",
];

export function parseBoutiqueListParams(input = {}) {
  const rawSearch = typeof input.search === "string" ? input.search.trim() : "";
  const search = rawSearch ? rawSearch.slice(0, 120) : undefined;
  const status = BOUTIQUE_STATUSES.includes(input.status)
    ? input.status
    : undefined;
  const sort = BOUTIQUE_SORTS.includes(input.sort)
    ? input.sort
    : "created_desc";
  const cursor =
    typeof input.cursor === "string" && input.cursor.length <= 200
      ? input.cursor
      : undefined;
  return { search, status, sort, cursor };
}

export function parseCursorHistory(value) {
  if (typeof value !== "string" || value.length > 4000) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === "string" && item.length <= 200)
      .slice(-20);
  } catch {
    return [];
  }
}

export function validateBoutiqueAction(body) {
  if (!body || typeof body !== "object") return null;
  const { action, boutique_id: boutiqueId, reason } = body;
  if (action !== "suspend" && action !== "restore") return null;
  if (
    typeof boutiqueId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      boutiqueId,
    )
  ) {
    return null;
  }
  if (typeof reason !== "string") return null;
  const cleanReason = reason.trim();
  if (!cleanReason || cleanReason.length > 1000) return null;
  return { action, boutiqueId, reason: cleanReason };
}
