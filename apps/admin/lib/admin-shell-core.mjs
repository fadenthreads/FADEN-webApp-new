export function getAdminAccessRedirect(state) {
  if (!state.authenticated) return "/auth/sign-in";
  if (state.role !== "admin") return "/auth/unauthorized";
  if (state.aal !== "aal2") return "/auth/mfa";
  return null;
}

export const ADMIN_PRIMARY_NAV = [
  { key: "overview", href: "/", label: "Overview", icon: "dashboard" },
  {
    key: "boutiques",
    href: "/boutiques",
    label: "Marketplace",
    icon: "storefront",
  },
  {
    key: "orders",
    href: "/orders",
    label: "Commerce",
    icon: "payments",
    section: "commerce",
  },
  {
    key: "disputes",
    href: "/disputes",
    label: "Trust & Support",
    icon: "verified_user",
  },
  {
    key: "configuration",
    href: "/configuration",
    label: "Platform",
    icon: "settings_input_component",
  },
  {
    key: "audit",
    href: "/audit",
    label: "Administration",
    icon: "admin_panel_settings",
  },
];

export const ADMIN_COMMERCE_NAV = [
  { key: "orders", href: "/orders", label: "Orders", icon: "shopping_bag" },
  {
    key: "settlements",
    href: "/settlements",
    label: "Settlements",
    icon: "account_balance",
  },
];

export const ADMIN_PAGE_META = {
  "/": {
    key: "overview",
    title: "Platform Overview",
    description:
      "Command center for marketplace operations. Live metrics arrive in ticket A02.",
    placeholderTicket: "A02",
  },
  "/boutiques": {
    key: "boutiques",
    title: "Boutique Directory",
    description: "Search, filter and moderate verified boutiques.",
    placeholderTicket: "A03",
  },
  "/orders": {
    key: "orders",
    title: "Order Operations",
    description: "Comprehensive view of platform commerce and fulfilment.",
    placeholderTicket: "A05",
  },
  "/disputes": {
    key: "disputes",
    title: "Disputes",
    description: "Customer and boutique dispute resolution workflows.",
    placeholderTicket: "A06",
  },
  "/settlements": {
    key: "settlements",
    title: "Settlements",
    description: "Financial view of pending and historical payouts.",
    placeholderTicket: "A07",
  },
  "/audit": {
    key: "audit",
    title: "Audit Log",
    description: "Privileged platform activity and configuration history.",
    placeholderTicket: "A08",
  },
  "/configuration": {
    key: "configuration",
    title: "Platform Configuration",
    description: "Typed settings, validation and version history.",
    placeholderTicket: "A09",
  },
};

export function normalizeAdminPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length ? trimmed : "/";
}

export function getAdminPageMeta(pathname) {
  const normalized = normalizeAdminPath(pathname);
  return ADMIN_PAGE_META[normalized] ?? ADMIN_PAGE_META["/"];
}

export function isAdminNavActive(pathname, item) {
  const normalized = normalizeAdminPath(pathname);
  if (item.key === "overview") return normalized === "/";
  if (item.section === "commerce") {
    return normalized === "/orders" || normalized === "/settlements";
  }
  return normalized === item.href;
}

export function isCommerceSubnavVisible(pathname) {
  const normalized = normalizeAdminPath(pathname);
  return normalized === "/orders" || normalized === "/settlements";
}

export function shouldCloseMobileMenu(key) {
  return key === "Escape";
}
