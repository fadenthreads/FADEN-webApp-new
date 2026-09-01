export function GET() {
  return Response.json({
    application: "studio",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
