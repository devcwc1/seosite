// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent } from "@/test/render";

import { Combobox, type ComboboxOption } from "./combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "medicines", label: "Medicines" },
  { value: "vitamins", label: "Vitamins" },
  { value: "skincare", label: "Skincare" },
];

function Host({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = React.useState<string | null>(initial);
  return (
    <Combobox
      options={OPTIONS}
      value={value}
      onChange={setValue}
      ariaLabel="Category"
      placeholder="Choose a category"
    />
  );
}

describe("Combobox", () => {
  it("has an accessible name even with no visible label", () => {
    renderUI(<Host />);

    expect(screen.getByRole("button", { name: "Category" })).toBeInTheDocument();
  });

  it("shows the placeholder until something is chosen", () => {
    renderUI(<Host />);

    expect(screen.getByText("Choose a category")).toBeInTheDocument();
  });

  it("shows the chosen option's label, not its value", () => {
    renderUI(<Host initial="vitamins" />);

    expect(screen.getByText("Vitamins")).toBeInTheDocument();
    expect(screen.queryByText("vitamins")).toBeNull();
  });

  it("opens from the keyboard and selects without a mouse", async () => {
    const user = userEvent.setup();
    renderUI(<Host />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Category" })).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.keyboard("Vita");

    const option = await screen.findByText("Vitamins");
    await user.click(option);

    expect(screen.getByRole("button", { name: "Category" })).toHaveTextContent(
      "Vitamins",
    );
  });

  it("reports its expanded state to assistive tech", async () => {
    const user = userEvent.setup();
    renderUI(<Host />);

    const trigger = screen.getByRole("button", { name: "Category" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("passes axe when closed", async () => {
    const { container } = renderUI(<Host initial="skincare" />);

    await expectNoA11yViolations(container);
  });
});
