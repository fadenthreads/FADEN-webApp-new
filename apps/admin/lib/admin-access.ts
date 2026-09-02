export type AdminAccessState = {
  authenticated: boolean;
  role: string | null;
  aal: string | null;
};

export { getAdminAccessRedirect } from "./admin-shell-core.mjs";
