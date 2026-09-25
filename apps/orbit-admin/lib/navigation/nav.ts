import "server-only";

import { isAdmin } from "@/lib/auth/session";
import type { User } from "@/lib/db/schema";

/**
 * Navigation is computed on the server from the session's role — FR-SEC-006.
 *
 * Hiding an item is a courtesy: it spares an editor a link that would only
 * 403. It is not the control. Every route named `adminOnly` here also guards
 * itself server-side, and lib/navigation/nav.test.ts asserts the two agree,
 * so a route can never end up hidden-but-unguarded.
 */

/**
 * Icons travel as names, not components: a function cannot cross the
 * server/client boundary, and the sidebar that renders them is a client
 * component (it needs the pathname for the active state).
 */
export type NavIcon =
  | "dashboard"
  | "products"
  | "categories"
  | "orders"
  | "media"
  | "users"
  | "settings"
  | "blog";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Requires the admin role. Mirrored by a server guard on the route. */
  adminOnly?: boolean;
};

const ALL_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/categories", label: "Categories", icon: "categories" },
  { href: "/blog", label: "Blog", icon: "blog" },
  { href: "/orders", label: "Orders", icon: "orders" },
  { href: "/media", label: "Media", icon: "media" },
  { href: "/users", label: "Users", icon: "users", adminOnly: true },
  // Settings is readable by every role — the page itself gates editing on
  // isAdmin — so it is not adminOnly. Marking it so would promise a 403 the
  // route does not give.
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Route prefixes that must be guarded server-side, derived from the nav. */
export const ADMIN_ONLY_PREFIXES: readonly string[] = ALL_ITEMS.filter(
  (item) => item.adminOnly,
).map((item) => item.href);

export function navigationFor(user: Pick<User, "role">): NavItem[] {
  const admin = isAdmin(user);
  return ALL_ITEMS.filter((item) => !item.adminOnly || admin);
}
