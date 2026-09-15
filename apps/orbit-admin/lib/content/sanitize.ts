import sanitizeHtml from "sanitize-html";

/**
 * Rich text is stored as HTML and rendered by the storefront with
 * `dangerouslySetInnerHTML`, so this function is the security boundary for
 * product copy. It runs on write, in the mutation — never in the browser,
 * where an attacker controls the code.
 *
 * The allowlist is what an editor needs to write a product description:
 * headings, paragraphs, emphasis, lists, quotes and links. Everything else is
 * discarded, including the tags that make HTML dangerous (`script`, `style`,
 * `iframe`), every `on*` handler, and any attribute not named below.
 *
 * `h1` is deliberately absent: the storefront gives the product title the
 * page's only h1, and a second one in body copy is both a document-outline
 * mistake and an SEO one.
 */
const ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "h4",
  "strong",
  "em",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "br",
  "a",
] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: {
    // `rel` is here so the transform below can add it; an editor's own value
    // is overwritten rather than trusted.
    a: ["href", "title", "rel"],
  },
  // No `javascript:` or `data:` URLs: both are script-execution vectors.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  // A link that survives sanitisation is treated as untrusted and outbound.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
    }),
  },
  // Strip comments, which can smuggle markup past naive downstream parsing.
  allowedClasses: {},
  disallowedTagsMode: "discard",
};

/** True when the markup carries nothing a reader would see. */
export function isEmptyRichText(html: string): boolean {
  const withoutTags = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return withoutTags === "";
}

/**
 * Sanitise editor output for storage. Returns an empty string for markup that
 * renders to nothing, so "empty" is one value in the database rather than
 * several spellings of it (`<p></p>`, `<p><br></p>`, whitespace).
 */
export function sanitizeRichText(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return isEmptyRichText(clean) ? "" : clean;
}

/** Plain text of the markup, for meta descriptions and search. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
