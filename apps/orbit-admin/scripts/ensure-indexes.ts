import "dotenv/config";

import { mongoClient } from "../lib/db/mongo";
import { ensureIndexes } from "../lib/db/mongo-indexes";
import { logger } from "../lib/logger";

/**
 * Create every MongoDB index the data model needs (idempotent). The app also
 * does this at boot via `instrumentation.ts`; this script is for provisioning a
 * fresh database directly — CI before the test run, or an Atlas cluster on
 * deploy — without starting the server.
 *
 *   npm run db:indexes
 */
const log = logger.child({ script: "ensure-indexes" });

ensureIndexes()
  .then(async () => {
    log.info("Indexes ensured");
    await mongoClient.close();
    process.exit(0);
  })
  .catch(async (error) => {
    log.error({ err: error }, "Failed to ensure indexes");
    await mongoClient.close().catch(() => undefined);
    process.exit(1);
  });
