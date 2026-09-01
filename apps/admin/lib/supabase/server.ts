import {
  createFadenServerClient,
  type FadenCookieMethods,
} from "@faden/supabase";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const cookieMethods: FadenCookieMethods = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, options, value }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        // Server Components cannot write cookies; middleware handles refreshes.
      }
    },
  };
  return createFadenServerClient(cookieMethods);
}
