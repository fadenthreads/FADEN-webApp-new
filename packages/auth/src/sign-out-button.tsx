"use client";

import { createFadenBrowserClient } from "@faden/supabase";
import { useRouter } from "next/navigation";

export function SignOutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();

  async function signOut() {
    await createFadenBrowserClient().auth.signOut();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button className="button button--ghost" onClick={signOut} type="button">
      Sign out
    </button>
  );
}
