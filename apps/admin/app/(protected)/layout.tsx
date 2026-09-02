import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AdminShell } from "../../components/admin-shell";
import { requireAdminSession } from "../../lib/admin-session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdminSession();
  const pathname = (await headers()).get("x-pathname") ?? "/";

  return (
    <AdminShell session={session} pathname={pathname}>
      {children}
    </AdminShell>
  );
}
