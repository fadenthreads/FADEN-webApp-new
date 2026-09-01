import {
  createFadenServerClient,
  type FadenCookieMethods,
} from "@faden/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cookies: FadenCookieMethods = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value),
      );
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, options, value }) =>
        response.cookies.set(name, value, options),
      );
      Object.entries(headers).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
    },
  };
  const supabase = createFadenServerClient(cookies);
  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const openRoute =
    pathname.startsWith("/auth/") || pathname.startsWith("/api/");

  if (!data.user && !openRoute) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (data.user && !pathname.startsWith("/auth/callback")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (
      profile?.role !== "admin" &&
      !pathname.startsWith("/auth/unauthorized")
    ) {
      const unauthorized = request.nextUrl.clone();
      unauthorized.pathname = "/auth/unauthorized";
      return NextResponse.redirect(unauthorized);
    }

    if (profile?.role === "admin" && !pathname.startsWith("/auth/")) {
      const { data: assurance } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        const mfa = request.nextUrl.clone();
        mfa.pathname = "/auth/mfa";
        return NextResponse.redirect(mfa);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
