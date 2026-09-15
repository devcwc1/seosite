import { LogOut } from "lucide-react";

import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { logoutAction } from "@/lib/auth/actions";
import { navigationFor } from "@/lib/navigation/nav";
import type { User } from "@/lib/db/schema";

/**
 * The authenticated shell every protected screen composes into — ORB-106.
 *
 * Laid out for a 1440px reference and a 1280px minimum: the content column
 * stops at `--spacing-shell-max` so a table on a 2560px monitor stays
 * readable instead of stretching edge to edge.
 */
export function AdminShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  // Computed here, on the server, from the session — never in the browser.
  const navigation = navigationFor(user);

  return (
    <div className="bg-muted/20 flex min-h-screen">
      {/*
        First thing in the tab order: a keyboard user should not have to walk
        the whole sidebar on every navigation to reach the page (WCAG 2.4.1).
      */}
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring sr-only rounded-md px-4 py-2 focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>

      <aside className="bg-background hidden w-shell-sidebar shrink-0 flex-col border-r sm:flex">
        <div className="flex h-shell-bar items-center border-b px-5 text-section-title">
          Orbit Admin
        </div>
        <nav aria-label="Main" className="flex-1 p-3">
          <SidebarNav items={navigation} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background flex h-shell-bar items-center justify-between gap-4 border-b px-6">
          <Breadcrumbs />

          <div className="ml-auto flex items-center gap-3">
            {/*
              FR-API-003. Hard-coded until the sync feature reports real
              state; it reads its colour from the same registry as every
              other chip, so wiring it up later is a data change, not a
              styling one.
            */}
            <StatusChip domain="sync" value="synced" className="hidden md:inline-flex" />

            <span className="text-body text-muted-foreground hidden lg:inline">
              {user.email}
            </span>
            <StatusChip domain="role" value={user.role} />

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" aria-hidden />
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-shell-max flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
