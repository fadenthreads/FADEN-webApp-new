export async function readSavedItem(client, kind, entityId, userId) {
  if (!userId) return { saved: false, error: null };
  const table = kind === "design" ? "saved_designs" : "saved_boutiques";
  const key = kind === "design" ? "design_id" : "boutique_id";
  const result = await client
    .from(table)
    .select(key)
    .eq("user_id", userId)
    .eq(key, entityId)
    .maybeSingle();
  return { saved: Boolean(result.data), error: result.error };
}

export function insertSavedItem(client, kind, entityId, userId) {
  return kind === "design"
    ? client
        .from("saved_designs")
        .upsert(
          { design_id: entityId, user_id: userId },
          { onConflict: "user_id,design_id", ignoreDuplicates: true },
        )
    : client
        .from("saved_boutiques")
        .upsert(
          { boutique_id: entityId, user_id: userId },
          { onConflict: "user_id,boutique_id", ignoreDuplicates: true },
        );
}
