import "dotenv/config";

import { randomUUID } from "node:crypto";

import { hashPassword } from "../lib/auth/password";
import { mongoClient } from "../lib/db/mongo";
import {
  auditLogsCollection,
  productContentRevisionsCollection,
  productsCollection,
  settingsCollection,
  usersCollection,
  type EmbeddedProductContent,
} from "../lib/db/mongo-collections";
import { logger } from "../lib/logger";

/**
 * Seeds the MongoDB development database. Written against the collections
 * directly (not the `server-only` lib modules) so it runs under plain `tsx`.
 * Idempotent throughout: a second run touches nothing that already exists.
 */

const log = logger.child({ script: "seed" });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@orbit.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin123";

/**
 * Seed the initial admin. Returns the admin's id whether it was just created or
 * already existed, so later steps can attribute their rows to it. A second run
 * leaves an existing admin untouched (no password reset).
 */
async function seedAdmin(): Promise<string | null> {
  log.info({ email: ADMIN_EMAIL }, "Seeding initial admin user");

  const existing = await usersCollection().findOne({ email: ADMIN_EMAIL });
  if (existing) {
    log.warn(
      { email: ADMIN_EMAIL },
      "Admin already exists — left untouched (no password reset)",
    );
    return existing._id;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const id = randomUUID();

  // MFA is enforced by policy but not yet enrolled — the admin completes
  // enrolment on first sign-in.
  await usersCollection().insertOne({
    _id: id,
    email: ADMIN_EMAIL,
    passwordHash,
    role: "admin",
    status: "active",
    mfaEnforced: true,
    mfaEnrolled: false,
    createdAt: new Date(),
  });

  await auditLogsCollection().insertOne({
    _id: randomUUID(),
    actorId: id,
    action: "user.seeded",
    target: `user:${id}`,
    metadata: { role: "admin", via: "scripts/seed.ts" },
    createdAt: new Date(),
  });

  // A couple of sensible application defaults so `settings` is usable.
  await settingsCollection().insertMany([
    {
      _id: "mfa.issuer",
      value: "Orbit Admin",
      description: "Issuer label shown in authenticator apps.",
      updatedBy: id,
      updatedAt: new Date(),
    },
    {
      _id: "products.defaultCurrency",
      value: "EUR",
      description: "Default currency for newly created products.",
      updatedBy: id,
      updatedAt: new Date(),
    },
  ]);

  log.info({ id, email: ADMIN_EMAIL }, "Admin user created");
  return id;
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
};

/**
 * A small published catalog so the storefront has something to render before
 * any product has been authored through the admin UI. Galleries and categories
 * are left empty — images attach as media-library assets through the admin,
 * which a seed has no files for.
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
  },
];

/**
 * Insert the demo catalog. Idempotent: a product whose slug already exists is
 * left untouched, so re-running the seed does not duplicate it. Each product
 * embeds its content and mirrors v1 into the revision history.
 */
async function seedProducts(authorId: string | null): Promise<void> {
  for (const demo of DEMO_PRODUCTS) {
    const exists = await productsCollection().findOne(
      { slug: demo.slug },
      { projection: { _id: 1 } },
    );
    if (exists) {
      log.info({ slug: demo.slug }, "Product already exists — skipped");
      continue;
    }

    const productId = randomUUID();
    const now = new Date();
    const content: EmbeddedProductContent = {
      title: demo.title,
      shortInfo: demo.shortInfo,
      description: demo.description,
      images: [],
      categories: [],
      meta: {},
      reviews: [],
      locale: "en",
      version: 1,
    };

    await productsCollection().insertOne({
      _id: productId,
      sku: demo.sku,
      slug: demo.slug,
      status: "published",
      priceCents: demo.priceCents,
      currency: demo.currency,
      inStock: demo.stockQuantity > 0,
      stockQuantity: demo.stockQuantity,
      content,
      media: [],
      createdBy: authorId,
      updatedBy: authorId,
      createdAt: now,
      updatedAt: now,
    });

    // Mirror v1 into the immutable history so revisions are never empty.
    await productContentRevisionsCollection().insertOne({
      _id: randomUUID(),
      productId,
      version: 1,
      data: {
        title: demo.title,
        shortInfo: demo.shortInfo,
        description: demo.description,
        images: [],
        categories: [],
        meta: {},
        reviews: [],
        locale: "en",
      },
      changeNote: "Seeded demo product",
      editedBy: authorId,
      createdAt: now,
    });

    log.info({ slug: demo.slug, id: productId }, "Product seeded");
  }
}

async function seed(): Promise<void> {
  const adminId = await seedAdmin();
  await seedProducts(adminId);
}

seed()
  .then(async () => {
    log.info("Seed complete");
    await mongoClient.close();
    process.exit(0);
  })
  .catch(async (error) => {
    log.error({ err: error }, "Seed failed");
    await mongoClient.close().catch(() => undefined);
    process.exit(1);
  });
