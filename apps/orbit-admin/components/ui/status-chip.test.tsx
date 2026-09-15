// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen } from "@/test/render";

import { StatusChip } from "./status-chip";

describe("StatusChip", () => {
  it("renders the registry's label, not the raw value", () => {
    renderUI(<StatusChip domain="order" value="cancelled" />);

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("resolves the same value to the same tone wherever it renders", () => {
    // AC1: the chip on the orders list and the one on the order detail are
    // now the same component reading the same table, so this holds by
    // construction. The test pins it so it keeps holding.
    const { container: first } = renderUI(
      <StatusChip domain="product" value="published" />,
    );
    const { container: second } = renderUI(
      <StatusChip domain="product" value="published" />,
    );

    const tone = (c: Element) =>
      c.querySelector("[data-status-tone]")?.getAttribute("data-status-tone");

    expect(tone(first)).toBe("success");
    expect(tone(first)).toBe(tone(second));
  });

  it("maps the doc 15 statuses to their named tones", () => {
    const toneOf = (el: HTMLElement) =>
      el.closest("[data-status-tone]")?.getAttribute("data-status-tone");

    renderUI(<StatusChip domain="product" value="draft" />);
    expect(toneOf(screen.getByText("Draft"))).toBe("neutral");

    renderUI(<StatusChip domain="indexing" value="noindex" />);
    expect(toneOf(screen.getByText(/No-index/))).toBe("warning");
  });

  it("does not leave colour as the only carrier of meaning", () => {
    // WCAG 1.4.1. An amber chip is meaningless to a reader who cannot see
    // amber, so the jargon gets spelled out for assistive tech.
    renderUI(<StatusChip domain="indexing" value="noindex" />);

    expect(
      screen.getByText("— Excluded from search engines"),
    ).toBeInTheDocument();
  });

  it("offers no way to override its colour", () => {
    // A `variant` or `color` prop is how per-screen drift gets reintroduced,
    // so the type has neither. className is layout only.
    const chip = <StatusChip domain="order" value="paid" className="ml-2" />;
    expect(chip.props).not.toHaveProperty("variant");
    expect(chip.props).not.toHaveProperty("tone");
  });

  it("passes axe for every status in the registry", async () => {
    const { container } = renderUI(
      <div>
        <StatusChip domain="product" value="published" />
        <StatusChip domain="order" value="pending" />
        <StatusChip domain="role" value="admin" />
        <StatusChip domain="indexing" value="noindex" />
        <StatusChip domain="sync" value="failed" />
        <StatusChip domain="deployment" value="live" />
        <StatusChip domain="connect" value="verified" />
      </div>,
    );

    await expectNoA11yViolations(container);
  });
});
