// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent } from "@/test/render";

import { Banner } from "./banner";

describe("Banner", () => {
  it("announces a failure without waiting to be read", () => {
    // role=alert preempts the screen reader. Right for a failure…
    renderUI(<Banner tone="danger" title="Sync failed" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Sync failed");
  });

  it("does not interrupt for good news", () => {
    // …and rude for anything else, which is why the other tones are status.
    renderUI(<Banner tone="success" title="All products synced" />);

    expect(screen.getByRole("status")).toHaveTextContent("All products synced");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no dismiss control unless dismissing is possible", () => {
    renderUI(<Banner tone="warning" title="Two products have no description" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the dismiss button after the thing it dismisses", async () => {
    // "Dismiss" alone is useless in a screen reader's list of controls.
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    renderUI(
      <Banner tone="info" title="Scheduled maintenance" onDismiss={onDismiss} />,
    );

    const button = screen.getByRole("button", {
      name: "Dismiss: Scheduled maintenance",
    });
    await user.click(button);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("can be dismissed from the keyboard", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    renderUI(<Banner tone="info" title="Heads up" onDismiss={onDismiss} />);

    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("passes axe in every tone", async () => {
    const { container } = renderUI(
      <div>
        <Banner tone="info" title="Info" />
        <Banner tone="success" title="Success" />
        <Banner tone="warning" title="Warning" />
        <Banner tone="danger" title="Danger" onDismiss={() => {}}>
          <p>With a body.</p>
        </Banner>
      </div>,
    );

    await expectNoA11yViolations(container);
  });
});
