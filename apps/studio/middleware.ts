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
  const publicRoute =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname === "/preview/overview" ||
    pathname === "/preview/portfolio";

  if (!data.user && !publicRoute) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
