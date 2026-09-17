import { serializeJsonLd } from "@orbit/next/seo";

/**
 * Structured data for search engines.
 *
 * `serializeJsonLd` is not a formality: the data includes editor-written
 * names, and plain JSON.stringify would let a product called
 * `</script><script>…` close this tag and run the rest as markup.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
