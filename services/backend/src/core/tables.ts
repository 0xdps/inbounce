import type { DatabaseHandle } from '@mesahub/client';
import { getSchemaFieldsTableName, getSubmissionsTableName } from './slug.js';

/**
 * Per-app table creation and management.
 * 
 * Each app gets two isolated tables:
 * - sef_<slug>: Schema fields (field definitions)
 * - sub_<slug>: Submissions (form submissions)
 * 
 * Tables are created on-demand on first use.
 */

/**
 * Create per-app submission tables (schema fields + submissions)
 * Safe to call repeatedly (uses IF NOT EXISTS).
 * 
 * @param db - Database connection
 * @param slug - App slug (e.g., "newsletter-app-x7k2")
 */
export async function ensureAppTables(db: DatabaseHandle, slug: string): Promise<void> {
  const schemaTable = getSchemaFieldsTableName(slug);
  const submissionsTable = getSubmissionsTableName(slug);

  // Create schema fields table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "${schemaTable}" (
      "id"           TEXT    PRIMARY KEY,
      "name"         TEXT    NOT NULL,
      "type"         TEXT    NOT NULL,
      "required"     INTEGER NOT NULL DEFAULT 0,
      "unique"       INTEGER NOT NULL DEFAULT 0,
      "position"     INTEGER NOT NULL DEFAULT 0,
      "compound_key" TEXT,
      "created_at"   INTEGER NOT NULL,
      "updated_at"   INTEGER NOT NULL
    )
  `);

  await db.exec(
    `CREATE INDEX IF NOT EXISTS "idx_${schemaTable}_position" ON "${schemaTable}" ("position")`,
  );

  // Create submissions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "${submissionsTable}" (
      "id"              TEXT    PRIMARY KEY,
      "data"            TEXT    NOT NULL,
      "idempotency_key" TEXT,
      "ip"              TEXT,
      "meta"            TEXT,
      "dup_count"       INTEGER NOT NULL DEFAULT 0,
      "last_seen_at"    INTEGER,
      "created_at"      INTEGER NOT NULL
    )
  `);

  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${submissionsTable}_idempotency" ON "${submissionsTable}" ("idempotency_key")`,
  );

  await db.exec(
    `CREATE INDEX IF NOT EXISTS "idx_${submissionsTable}_created_at" ON "${submissionsTable}" ("created_at")`,
  );
}

/**
 * Drop per-app tables when app is deleted.
 * Safe to call even if tables don't exist.
 * 
 * @param db - Database connection
 * @param slug - App slug
 */
export async function dropAppTables(db: DatabaseHandle, slug: string): Promise<void> {
  const schemaTable = getSchemaFieldsTableName(slug);
  const submissionsTable = getSubmissionsTableName(slug);

  try {
    await db.exec(`DROP TABLE IF EXISTS ${schemaTable}`);
    await db.exec(`DROP TABLE IF EXISTS ${submissionsTable}`);
  } catch (err) {
    // Silently fail on cleanup - tables may not exist
  }
}
