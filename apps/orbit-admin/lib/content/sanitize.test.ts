import { describe, expect, it } from "vitest";

import { isEmptyRichText, richTextToPlain, sanitizeRichText } from "./sanitize";

/**
 * This is the boundary that makes rendering stored HTML safe, so the cases
 * below are the ones an attacker would actually try.
 */
describe("sanitizeRichText", () => {
  it("keeps the tags an editor writes with", () => {
    const html =
      "<h2>Dosage</h2><p>Take <strong>one</strong> tablet.</p><ul><li>Before bed</li></ul>";

    expect(sanitizeRichText(html)).toBe(html);
  });

  it("discards script tags and their contents", () => {
    const clean = sanitizeRichText(
      "<p>Safe</p><script>fetch('/steal')</script>",
    );

    expect(clean).toBe("<p>Safe</p>");
    expect(clean).not.toContain("fetch");
  });

  it("strips event handlers from otherwise allowed tags", () => {
    const clean = sanitizeRichText(
      `<p onclick="alert(1)" onmouseover="alert(2)">Hover</p>`,
    );

    expect(clean).toBe("<p>Hover</p>");
  });

  it("drops javascript: and data: links but keeps real ones", () => {
    expect(sanitizeRichText(`<p><a href="javascript:alert(1)">x</a></p>`)).not.toContain(
      "javascript:",
    );
    expect(
      sanitizeRichText(`<p><a href="data:text/html,<script>">x</a></p>`),
    ).not.toContain("data:");

    const external = sanitizeRichText(`<p><a href="https://example.com">x</a></p>`);
    expect(external).toContain('href="https://example.com"');
  });

  it("marks surviving links as untrusted and outbound", () => {
    const clean = sanitizeRichText(`<p><a href="https://example.com">x</a></p>`);

    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("removes style and iframe, which are their own attack surface", () => {
    const clean = sanitizeRichText(
      `<p>Copy</p><style>body{display:none}</style><iframe src="https://evil.test"></iframe>`,
    );

    expect(clean).toBe("<p>Copy</p>");
  });

  it("keeps all six heading levels", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const html = `<h${level}>Heading</h${level}>`;
      expect(sanitizeRichText(html)).toBe(html);
    }
  });

  it("does not invent a seventh heading level", () => {
    // h7 is not a tag; it must be discarded like any other unknown element.
    expect(sanitizeRichText("<h7>Nope</h7>")).toBe("Nope");
  });

  it("strips literal backslash-escape artifacts left by CMS exports", () => {
    // WooCommerce and similar double-escape newlines, so the body carries the
    // two characters backslash-n as visible text. They must not survive.
    const bs = String.fromCharCode(92); // a single backslash
    const out = sanitizeRichText(`<p>Take one.${bs}nThen rest.</p>`);
    expect(out).not.toContain(`${bs}n`);
    expect(out).toBe("<p>Take one. Then rest.</p>");
  });

  it("leaves real content untouched", () => {
    expect(sanitizeRichText("<p>Winter <strong>sale</strong></p>")).toBe(
      "<p>Winter <strong>sale</strong></p>",
    );
  });

  it("normalises every spelling of empty to an empty string", () => {
    for (const empty of ["", "<p></p>", "<p><br></p>", "<p>&nbsp;</p>", "   "]) {
      expect(sanitizeRichText(empty)).toBe("");
    }
  });

  it("survives markup that tries to break out of an attribute", () => {
    const clean = sanitizeRichText(
      `<p title="a&quot;><script>alert(1)</script>">Text</p>`,
    );

    expect(clean).not.toContain("<script");
  });
});

describe("richTextToPlain", () => {
  it("flattens markup for meta descriptions", () => {
    expect(
      richTextToPlain("<h2>Sleep aid</h2><p>Helps you  rest.</p>"),
    ).toBe("Sleep aidHelps you rest.");
  });
});

describe("isEmptyRichText", () => {
  it("sees through tags to the text", () => {
    expect(isEmptyRichText("<p><br></p>")).toBe(true);
    expect(isEmptyRichText("<p>a</p>")).toBe(false);
  });
});
