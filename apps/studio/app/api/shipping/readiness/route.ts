import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { getShiprocketReadiness } from "../../../../lib/shiprocket-core.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  if (!(await supabase.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const readiness = getShiprocketReadiness();
  return NextResponse.json(
    {
      provider: readiness.provider,
      configured: readiness.configured,
      apiEnabled: readiness.apiEnabled,
      liveBookingEnabled: readiness.liveBookingEnabled,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
