import { NextResponse } from "next/server";

import { isMigrationComplete } from "@/lib/db/migration-state";

// Readiness must reflect live process state, never a cached response.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness probe. Returns 503 until startup DB preparation (ensuring the
 * MongoDB indexes) has completed, then 200. Point a load balancer / orchestrator
 * readiness check here so traffic is only routed once the database is ready.
 */
export function GET(): NextResponse {
  const ready = isMigrationComplete();

  return NextResponse.json(
    {
      status: ready ? "ok" : "starting",
      migrationsComplete: ready,
    },
    { status: ready ? 200 : 503 },
  );
}
