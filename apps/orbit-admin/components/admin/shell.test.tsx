// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent } from "@/test/render";
import type { NavItem } from "@/lib/navigation/nav";

const pathname = vi.hoisted(() => ({ current: "/products" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { Breadcrumbs } from "./breadcrumbs";
import { SidebarNav } from "./sidebar-nav";

const EDITOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/media", label: "Media", icon: "media" },
];

describe("SidebarNav", () => {
  it("renders exactly the items the server handed it", () => {
    // The component does no filtering of its own: whatever navigationFor()
    // decided is what appears, so there is one place role logic can live.
    renderUI(<SidebarNav items={EDITOR_NAV} />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /users/i })).toBeNull();
  });

  it("marks the current section with aria-current", () => {
    pathname.current = "/products";
    renderUI(<SidebarNav items={EDITOR_NAV} />);

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps the section current on its child routes", () => {
    pathname.current = "/products/new";
    renderUI(<SidebarNav items={EDITOR_NAV} />);

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not treat a longer sibling route as a child", () => {
    // /media must not light up for /media-library.
    pathname.current = "/media-library";
    renderUI(<SidebarNav items={EDITOR_NAV} />);

    expect(screen.getByRole("link", { name: "Media" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("reaches every item by keyboard alone", async () => {
    pathname.current = "/dashboard";
    const user = userEvent.setup();
    renderUI(<SidebarNav items={EDITOR_NAV} />);

    for (const item of EDITOR_NAV) {
      await user.tab();
      expect(screen.getByRole("link", { name: item.label })).toHaveFocus();
    }
  });

  it("passes axe", async () => {
    pathname.current = "/products";
    const { container } = renderUI(
      <nav aria-label="Main">
        <SidebarNav items={EDITOR_NAV} />
      </nav>,
    );

    await expectNoA11yViolations(container);
  });
});

describe("Breadcrumbs", () => {
  it("says nothing on a landing page", () => {
    // A trail of one crumb is noise.
    pathname.current = "/products";
    const { container } = renderUI(<Breadcrumbs />);

    expect(container).toBeEmptyDOMElement();
  });

  it("builds a trail with the last crumb as the current page", () => {
    pathname.current = "/products/new";
    renderUI(<Breadcrumbs />);

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/products",
    );
    // The WAI-ARIA breadcrumb pattern: the current page is not a link.
    expect(screen.getByText("New")).toHaveAttribute("aria-current", "page");
  });

  it("shortens an opaque id instead of reading it out in full", () => {
    pathname.current = "/orders/0d18873d-4161-4e5e-93e2-127f46266593";
    renderUI(<Breadcrumbs />);

    expect(screen.getByText("#0d18873d")).toBeInTheDocument();
  });

  it("passes axe", async () => {
    pathname.current = "/products/new";
    const { container } = renderUI(<Breadcrumbs />);

    await expectNoA11yViolations(container);
  });
});
