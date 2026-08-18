import "dotenv/config";

import { eq } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { db, pool } from "../lib/db";
import {
  auditLogs,
  productContent,
  productContentRevisions,
  products,
  settings,
  users,
  type ProductCategory,
  type ProductImage,
} from "../lib/db/schema";
import { logger } from "../lib/logger";

const log = logger.child({ script: "seed" });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@orbit.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin123";

/**
 * Seed the initial admin. Returns the admin's id whether it was just created or
 * already existed, so later steps can attribute their rows to it.
 */
async function seedAdmin(): Promise<string | null> {
  log.info({ email: ADMIN_EMAIL }, "Seeding initial admin user");

  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  // Insert the admin. MFA is enforced by policy but not yet enrolled — the
  // admin completes enrolment on first sign-in.
  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      mfaEnforced: true,
      mfaEnrolled: false,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email });

  if (!admin) {
    log.warn(
      { email: ADMIN_EMAIL },
      "Admin already exists — left untouched (no password reset)",
    );

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    return existing?.id ?? null;
  }

  await db.insert(auditLogs).values({
    actorId: admin.id,
    action: "user.seeded",
    target: `user:${admin.id}`,
    metadata: { role: "admin", via: "scripts/seed.ts" },
  });

  // A couple of sensible application defaults so `settings` is usable.
  await db
    .insert(settings)
    .values([
      {
        key: "mfa.issuer",
        value: "Orbit Admin",
        description: "Issuer label shown in authenticator apps.",
        updatedBy: admin.id,
      },
      {
        key: "products.defaultCurrency",
        value: "EUR",
        description: "Default currency for newly created products.",
        updatedBy: admin.id,
      },
    ])
    .onConflictDoNothing({ target: settings.key });

  log.info({ id: admin.id, email: admin.email }, "Admin user created");

  return admin.id;
}

/* -------------------------------------------------------------------------- */
/*  Demo catalog                                                               */
/* -------------------------------------------------------------------------- */

type DemoProduct = {
  sku: string;
  slug: string;
  priceCents: number;
  currency: string;
  stockQuantity: number;
  title: string;
  shortInfo: string;
  description: string;
  images: ProductImage[];
  categories: ProductCategory[];
};

/**
 * A small published catalog so the storefront has something to render before
 * any product has been authored through the admin UI. Every entry is
 * `published`, which is the only status the storefront read model exposes.
 */
const DEMO_PRODUCTS: DemoProduct[] = [
  {
    sku: "ORB-MUG-01",
    slug: "orbit-mug",
    priceCents: 1899,
    currency: "EUR",
    stockQuantity: 42,
    title: "Orbit Mug",
    shortInfo: "A 350ml ceramic mug with the Orbit mark.",
    description:
      "Double-walled ceramic, dishwasher and microwave safe. Holds 350ml.",
    images: [
      {
        url: "https://picsum.photos/seed/orbit-mug-a/800/800",
        alt: "Orbit Mug, front view",
        position: 1,
      },
      {
        url: "https://picsum.photos/seed/orbit-mug-b/800/800",
        alt: "Orbit Mug, side view",
        position: 2,
      },
    ],
    categories: [
      { slug: "drinkware", name: "Drinkware", isPrimary: true },
      { slug: "gifts", name: "Gifts", isPrimary: false },
    ],
  },
  {
    sku: "ORB-TEE-01",
    slug: "orbit-tee",
    priceCents: 2500,
    currency: "EUR",
    stockQuantity: 0,
    title: "Orbit Tee",
    shortInfo: "Heavyweight cotton t-shirt.",
    description:
      "220gsm combed cotton, pre-shrunk, printed with a single-colour Orbit mark.",
    images: [
      {
        url: "https://picsum.photos/seed/orbit-tee-a/800/800",
        alt: "Orbit Tee, flat lay",
        position: 1,
      },
    ],
    categories: [{ slug: "apparel", name: "Apparel", isPrimary: true }],
  },
  {
    sku: "ORB-NOTE-01",
    slug: "orbit-notebook",
    priceCents: 1200,
    currency: "EUR",
    stockQuantity: 130,
    title: "Orbit Notebook",
    shortInfo: "A5 dotted notebook, 192 pages.",
    description:
      "Sewn binding that lies flat, 100gsm bleed-resistant paper, elastic closure.",
    images: [
      {
        url: "https://picsum.photos/seed/orbit-notebook-a/800/800",
        alt: "Orbit Notebook, cover",
        position: 1,
      },
    ],
    categories: [{ slug: "stationery", name: "Stationery", isPrimary: true }],
  },
];

/**
 * Insert the demo catalog. Idempotent: products conflict on their unique slug,
 * so re-running the seed leaves an existing catalog untouched.
 */
async function seedProducts(authorId: string | null): Promise<void> {
  for (const demo of DEMO_PRODUCTS) {
    const [product] = await db
      .insert(products)
      .values({
        sku: demo.sku,
        slug: demo.slug,
        status: "published",
        priceCents: demo.priceCents,
        currency: demo.currency,
        stockQuantity: demo.stockQuantity,
        createdBy: authorId,
      })
      .onConflictDoNothing({ target: products.slug })
      .returning({ id: products.id });

    if (!product) {
      log.info({ slug: demo.slug }, "Product already exists — skipped");
      continue;
    }

    const [content] = await db
      .insert(productContent)
      .values({
        productId: product.id,
        title: demo.title,
        shortInfo: demo.shortInfo,
        description: demo.description,
        images: demo.images,
        categories: demo.categories,
        locale: "en",
        version: 1,
        updatedBy: authorId,
      })
      .returning({ id: productContent.id });

    if (!content) {
      throw new Error(`Failed to create content for ${demo.slug}`);
    }

    // Mirror v1 into the immutable history so revisions are never empty.
    await db.insert(productContentRevisions).values({
      contentId: content.id,
      productId: product.id,
      version: 1,
      data: {
        title: demo.title,
        shortInfo: demo.shortInfo,
        description: demo.description,
        images: demo.images,
        categories: demo.categories,
        meta: {},
        reviews: [],
        locale: "en",
      },
      changeNote: "Seeded demo product",
      editedBy: authorId,
    });

    // Publish the content by pointing the product at its live revision.
    await db
      .update(products)
      .set({ currentContentId: content.id })
      .where(eq(products.id, product.id));

    log.info({ slug: demo.slug, id: product.id }, "Product seeded");
  }
}

async function seed(): Promise<void> {
  const adminId = await seedAdmin();
  await seedProducts(adminId);
}

seed()
  .then(async () => {
    log.info("Seed complete");
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    log.error({ err: error }, "Seed failed");
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
