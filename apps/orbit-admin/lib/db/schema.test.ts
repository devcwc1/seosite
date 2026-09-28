import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  auditLogs,
  productContent,
  productContentRevisions,
  products,
  sessions,
  settings,
  users,
} from "./schema";

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table)
    .columns.map((column) => column.name)
    .sort();
}

describe("db schema", () => {
  it("defines the users table with the required columns", () => {
    expect(columnNames(users)).toEqual(
      [
        "id",
        "email",
        "password_hash",
        "role",
        "status",
        "mfa_enforced",
        "mfa_enrolled",
        "created_at",
      ].sort(),
    );
  });

  it("defines the audit_logs table with the required columns", () => {
    expect(columnNames(auditLogs)).toEqual(
      ["id", "actor_id", "action", "target", "metadata", "created_at"].sort(),
    );
  });

  it("exposes every scaffolded table with its expected name", () => {
    const tables = {
      users,
      sessions,
      products,
      product_content: productContent,
      product_content_revisions: productContentRevisions,
      audit_logs: auditLogs,
      settings,
    };

    for (const [expectedName, table] of Object.entries(tables)) {
      expect(getTableConfig(table).name).toBe(expectedName);
    }
  });

  it("marks mfa flags on new users as non-nullable", () => {
    const config = getTableConfig(users);
    const mfaEnforced = config.columns.find((c) => c.name === "mfa_enforced");
    const mfaEnrolled = config.columns.find((c) => c.name === "mfa_enrolled");

    expect(mfaEnforced?.notNull).toBe(true);
    expect(mfaEnrolled?.notNull).toBe(true);
  });
});
