import "dotenv/config";

import { hashPassword } from "../lib/auth/password";
import { db, pool } from "../lib/db";
import { auditLogs, settings, users } from "../lib/db/schema";
import { logger } from "../lib/logger";

const log = logger.child({ script: "seed" });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@orbit.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin123";

async function seed(): Promise<void> {
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
    return;
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
