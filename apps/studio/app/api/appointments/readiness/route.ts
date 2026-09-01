import { NextResponse } from "next/server";
import { getDailyReadiness } from "@faden/integrations";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  if (!(await supabase.auth.getUser()).data.user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const readiness = getDailyReadiness();
  return NextResponse.json(
    {
      provider: readiness.provider,
      configured: readiness.configured,
      apiEnabled: readiness.apiEnabled,
      liveRoomsEnabled: readiness.liveRoomsEnabled,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
