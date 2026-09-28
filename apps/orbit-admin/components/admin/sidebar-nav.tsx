"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Files,
  FolderTree,
  Images,
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/lib/navigation/nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Boxes,
  categories: FolderTree,
  orders: Receipt,
  media: Images,
  users: Users,
  settings: Settings,
  blog: FileText,
  pages: Files,
};

/**
 * The items arrive already filtered by the server. This component decides
 * which one is current, and nothing about who may see what.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        // `/products/new` should light up `/products`, but `/media` must not
        // light up for `/media-library`, hence the boundary check.
        const current =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                current
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
