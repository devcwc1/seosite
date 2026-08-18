import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { StorefrontProduct } from "@orbit/next";

import { formatPrice, orbit, primaryImage } from "@/lib/orbit";

/**
 * The `[id]` segment carries a product's public slug — the stable identifier
 * `@orbit/next` looks products up by (`OrbitClient.getProduct`).
 */
type ProductPageProps = {
  params: Promise<{ id: string }>;
};

async function loadProduct(id: string): Promise<StorefrontProduct | null> {
  try {
    // The SDK already maps a 404 to `null`; this guards transport failures.
    return await orbit.getProduct(id);
  } catch {
    return null;
  }
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const products = await orbit.listProducts();
    return products.map((product) => ({ id: product.slug }));
  } catch {
    // Content API unreachable at build time — fall back to on-demand rendering.
    return [];
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.title,
    description: product.shortInfo ?? undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) {
    notFound();
  }

  const image = primaryImage(product);

  return (
    <article>
      <h1>{product.title}</h1>

      <dl>
        <dt>SKU</dt>
        <dd>{product.sku}</dd>

        <dt>Price</dt>
        <dd>{formatPrice(product)}</dd>

        <dt>Availability</dt>
        <dd>{product.inStock ? "In stock" : "Out of stock"}</dd>
      </dl>

      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.alt ?? product.title} />
      ) : null}

      {product.shortInfo ? <p>{product.shortInfo}</p> : null}
      {product.description ? <p>{product.description}</p> : null}

      {product.categories.length > 0 ? (
        <section>
          <h2>Categories</h2>
          <ul>
            {product.categories.map((category) => (
              <li key={category.slug}>
                {category.name}
                {category.isPrimary ? " (primary)" : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
