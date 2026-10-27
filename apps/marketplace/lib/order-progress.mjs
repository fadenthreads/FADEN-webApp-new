export function orderProgressSummary(updates, failed, stages) {
  if (failed)
    return {
      title: "Production updates unavailable",
      detail: "Refresh to try loading the latest boutique update again.",
    };
  const latest = updates?.[0];
  if (!latest)
    return {
      title: "Awaiting first production update",
      detail:
        "Your boutique's production notes and photos will appear as work progresses.",
    };
  return {
    title: stages[latest.stage - 1] || "Production update",
    detail: latest.note || "Your boutique has recorded a production update.",
  };
}
