// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent } from "@/test/render";

import { CountedInput, CountedTextarea } from "./counted-field";

/** The fields are controlled; a host holds the value the way a form would. */
function Host({ max = 20, initial = "" }: { max?: number; initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <label htmlFor="meta-title">Meta title</label>
      <CountedInput
        id="meta-title"
        maxLength={max}
        warnAt={5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </>
  );
}

describe("CountedInput", () => {
  it("shows how much of the budget is used", () => {
    renderUI(<Host initial="Hello" />);

    expect(screen.getByText("5 of 20 characters")).toBeInTheDocument();
  });

  it("updates as the reader types", async () => {
    const user = userEvent.setup();
    renderUI(<Host />);

    await user.type(screen.getByLabelText("Meta title"), "abc");

    expect(screen.getByText("3 of 20 characters")).toBeInTheDocument();
  });

  it("ties the counter to the field so it is announced, not just seen", () => {
    // WCAG 3.3.2: the constraint has to reach a screen reader too.
    renderUI(<Host initial="Hi" />);

    const field = screen.getByLabelText("Meta title");
    const describedBy = field.getAttribute("aria-describedby");

    expect(describedBy).toBe("meta-title-counter");
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "2 of 20 characters",
    );
  });

  it("stays polite while there is room left", () => {
    renderUI(<Host initial="Hi" />);

    expect(screen.getByText("2 of 20 characters")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("stops the reader at the limit rather than silently truncating later", async () => {
    const user = userEvent.setup();
    renderUI(<Host max={5} />);

    const field = screen.getByLabelText("Meta title");
    await user.type(field, "abcdefghij");

    // maxLength is enforced by the control itself, so the count cannot lie.
    expect(field).toHaveValue("abcde");
    expect(screen.getByText("5 of 5 characters")).toBeInTheDocument();
  });

  it("passes axe", async () => {
    const { container } = renderUI(<Host initial="Hello" />);

    await expectNoA11yViolations(container);
  });
});

describe("CountedTextarea", () => {
  it("counts the same way and is announced the same way", () => {
    renderUI(
      <>
        <label htmlFor="meta-description">Meta description</label>
        <CountedTextarea
          id="meta-description"
          maxLength={160}
          value={"x".repeat(12)}
          onChange={() => {}}
        />
      </>,
    );

    const field = screen.getByLabelText("Meta description");
    expect(field).toHaveAttribute("aria-describedby", "meta-description-counter");
    expect(screen.getByText("12 of 160 characters")).toBeInTheDocument();
  });
});
