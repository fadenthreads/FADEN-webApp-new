export function GET() {
  return Response.json({
    application: "marketplace",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
