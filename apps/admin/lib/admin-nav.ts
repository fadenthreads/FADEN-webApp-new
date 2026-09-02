export type AdminNavKey =
  | "overview"
  | "boutiques"
  | "orders"
  | "settlements"
  | "disputes"
  | "configuration"
  | "audit";

export type AdminNavItem = {
  key: AdminNavKey;
  href: string;
  label: string;
  icon: string;
  section?: "commerce";
};

export type AdminPageMeta = {
  key: AdminNavKey;
  title: string;
  description: string;
  placeholderTicket: string;
};

export {
  ADMIN_COMMERCE_NAV,
  ADMIN_PAGE_META,
  ADMIN_PRIMARY_NAV,
  getAdminPageMeta,
  isAdminNavActive,
  isCommerceSubnavVisible,
  normalizeAdminPath,
  shouldCloseMobileMenu,
} from "./admin-shell-core.mjs";
