import {
  createFadenServerClient,
  type FadenCookieMethods,
} from "@faden/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const openRoute =
    pathname.startsWith("/auth/") || pathname.startsWith("/api/");
  // Role and MFA are verified by requireAdminSession() in the protected
  // server layout. Middleware only establishes an authenticated session so it
  // does not add profile and MFA network calls to every navigation.
  if (openRoute) return response;

  const cookies: FadenCookieMethods = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value),
      );
      response = NextResponse.next({
        request: { headers: requestHeaders },
      });
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
  if (!data.user && !openRoute) {
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
