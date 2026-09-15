// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/test/a11y";
import { renderUI, screen, userEvent, waitFor } from "@/test/render";

import { RichTextEditor, formatHtml } from "./rich-text-editor";

/** The editor is controlled; a host holds the value the way the form does. */
function Host({
  initial = "",
  onValue,
}: {
  initial?: string;
  onValue?: (html: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <RichTextEditor
        value={value}
        onChange={(html) => {
          setValue(html);
          onValue?.(html);
        }}
        ariaLabel="Product description"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

async function ready() {
  // useEditor mounts asynchronously because immediatelyRender is false.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Edit HTML source" })).toBeEnabled(),
  );
}

describe("formatHtml", () => {
  it("puts one block on each line", () => {
    expect(formatHtml("<h2>Use</h2><p>Text</p>")).toBe("<h2>Use</h2>\n<p>Text</p>");
  });

  it("indents list items inside their list", () => {
    expect(formatHtml("<ul><li>One</li><li>Two</li></ul>")).toBe(
      "<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>",
    );
  });

  it("changes nothing but whitespace", () => {
    // The formatter must never be a second, disagreeing parser.
    const html = "<h1>A</h1><p>B <strong>C</strong></p><ol><li>D</li></ol>";
    expect(formatHtml(html).replace(/\s+/g, "")).toBe(html.replace(/\s+/g, ""));
  });

  it("survives markup it does not recognise", () => {
    expect(formatHtml("")).toBe("");
    expect(formatHtml("plain text")).toBe("plain text");
  });
});

describe("RichTextEditor headings", () => {
  it("offers every heading level plus paragraph", async () => {
    renderUI(<Host />);
    await ready();

    const select = screen.getByLabelText("Text style");
    const options = Array.from(
      select.querySelectorAll("option"),
      (option) => option.textContent,
    );

    expect(options).toEqual([
      "Paragraph",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Heading 5",
      "Heading 6",
    ]);
  });

  it("renders a heading at the level that was chosen", async () => {
    const user = userEvent.setup();
    renderUI(<Host initial="<p>Storage</p>" />);
    await ready();

    await user.click(screen.getByLabelText("Product description"));
    await user.selectOptions(screen.getByLabelText("Text style"), "h4");

    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("<h4>Storage</h4>"),
    );
  });
});

describe("RichTextEditor HTML source view", () => {
  it("starts on the visual editor", async () => {
    renderUI(<Host initial="<p>Hello</p>" />);
    await ready();

    expect(screen.getByRole("button", { name: "Edit HTML source" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByLabelText("Product description HTML source")).toBeNull();
  });

  it("shows the current markup, formatted, when opened", async () => {
    const user = userEvent.setup();
    renderUI(<Host initial="<h2>Use</h2><p>Take one.</p>" />);
    await ready();

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));

    expect(screen.getByLabelText("Product description HTML source")).toHaveValue(
      "<h2>Use</h2>\n<p>Take one.</p>",
    );
  });

  it("accepts pasted markup and keeps it through a round trip", async () => {
    // The point of the feature: paste HTML from somewhere else and have it
    // become real document structure rather than escaped text.
    const user = userEvent.setup();
    renderUI(<Host />);
    await ready();

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));

    const textarea = screen.getByLabelText("Product description HTML source");
    await user.clear(textarea);
    await user.paste("<h1>Dosage</h1><ul><li>One tablet</li></ul>");

    // Back to visual — the markup is parsed, not escaped.
    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));

    await waitFor(() => {
      const value = screen.getByTestId("value").textContent ?? "";
      expect(value).toContain("<h1>Dosage</h1>");
      // Tiptap's list-item schema wraps content in a paragraph, so the
      // markup that comes back is <li><p>…</p></li>. Both apps style
      // `li > p` flat so the extra element costs nothing visually.
      expect(value).toContain("<li><p>One tablet</p></li>");
      expect(value).not.toContain("&lt;h1&gt;");
    });
  });

  it("updates the form while markup is typed, without switching back", async () => {
    const user = userEvent.setup();
    renderUI(<Host />);
    await ready();

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));
    await user.type(
      screen.getByLabelText("Product description HTML source"),
      "<p>Typed</p>",
    );

    // Saving straight from the source view has to work.
    expect(screen.getByTestId("value")).toHaveTextContent("<p>Typed</p>");
  });

  it("drops markup the editor has no place for, visibly, on the way back", async () => {
    // Better that an editor sees the <table> disappear here than discover on
    // the storefront that the server stripped it.
    const user = userEvent.setup();
    renderUI(<Host />);
    await ready();

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));
    const textarea = screen.getByLabelText("Product description HTML source");
    await user.clear(textarea);
    await user.paste("<p>Keep</p><table><tr><td>Drop</td></tr></table>");
    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));

    await waitFor(() => {
      const value = screen.getByTestId("value").textContent ?? "";
      expect(value).toContain("Keep");
      expect(value).not.toContain("<table");
    });
  });

  it("disables the formatting controls that cannot apply to raw markup", async () => {
    const user = userEvent.setup();
    renderUI(<Host initial="<p>Hi</p>" />);
    await ready();

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));

    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
    expect(screen.getByLabelText("Text style")).toBeDisabled();
    // The toggle itself stays live, or there is no way back.
    expect(
      screen.getByRole("button", { name: "Edit HTML source" }),
    ).toBeEnabled();
  });

  it("passes axe in both views", async () => {
    const user = userEvent.setup();
    const { container } = renderUI(<Host initial="<h2>Use</h2>" />);
    await ready();

    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Edit HTML source" }));
    await expectNoA11yViolations(container);
  });
});
