export function GET() {
  return Response.json({
    application: "admin",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
