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

  const protectedRoute =
    request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname.startsWith("/saved") ||
    request.nextUrl.pathname.startsWith("/create") ||
    request.nextUrl.pathname.startsWith("/requests") ||
    request.nextUrl.pathname.startsWith("/offers") ||
    request.nextUrl.pathname.startsWith("/orders");
  if (protectedRoute && !data.user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.search = "";
    signIn.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
