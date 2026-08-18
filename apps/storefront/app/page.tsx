import Link from "next/link";
import type { StorefrontProduct } from "@orbit/next";

import { formatPrice, orbit, primaryImage } from "@/lib/orbit";

export const metadata = {
  title: "Catalog",
};

export default async function CatalogPage() {
  let products: StorefrontProduct[];

  try {
    products = await orbit.listProducts();
  } catch {
    // The content API is not reachable (not yet deployed, or briefly down).
    // Degrade to an empty catalog; the SDK's revalidation window retries.
    return (
      <section>
        <h1>Catalog</h1>
        <p>The catalog is temporarily unavailable. Please try again shortly.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Catalog</h1>

      {products.length === 0 ? (
        <p>No products are published yet.</p>
      ) : (
        <ul>
          {products.map((product) => {
            const image = primaryImage(product);

            return (
              <li key={product.id}>
                <article>
                  <Link href={`/products/${product.slug}`}>
                    {/* Images are arbitrary remote URLs from the content API,
                        so they bypass next/image's host allow-list. */}
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt={image.alt ?? product.title} />
                    ) : null}
                    <h2>{product.title}</h2>
                  </Link>

                  {product.shortInfo ? <p>{product.shortInfo}</p> : null}

                  <p>{formatPrice(product)}</p>
                  <p>{product.inStock ? "In stock" : "Out of stock"}</p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
