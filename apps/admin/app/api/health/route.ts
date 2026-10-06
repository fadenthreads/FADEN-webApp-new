import { checkSupabaseHealth } from "@faden/server";

export async function GET() {
  const database = await checkSupabaseHealth();
  return Response.json(
    {
      application: "admin",
      status: database.ok ? "ok" : "degraded",
      dependencies: {
        database: database.ok ? "ok" : database.reason,
        databaseLatencyMs: database.latencyMs,
      },
      timestamp: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 },
  );
}
