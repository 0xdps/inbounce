import { Database } from 'sqlite-hub-client';
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
export async function ensureAppTables(db: Database, slug: string): Promise<void> {
  const schemaTable = getSchemaFieldsTableName(slug);
  const submissionsTable = getSubmissionsTableName(slug);

  // Create schema fields table
  await db.createTable(
    schemaTable,
    [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'type', type: 'TEXT', notNull: true }, // string|email|number|boolean|url|date
      { name: 'required', type: 'INTEGER', notNull: true, default: 0 },
      { name: 'unique', type: 'INTEGER', notNull: true, default: 0 },
      { name: 'position', type: 'INTEGER', notNull: true, default: 0 },
      { name: 'compound_key', type: 'TEXT' },
      { name: 'created_at', type: 'INTEGER', notNull: true },
      { name: 'updated_at', type: 'INTEGER', notNull: true },
    ],
    { ifNotExists: true }
  );

  // Create index on position for fast ordering
  await db.createIndex(`idx_${schemaTable}_position`, schemaTable, ['position'], {
    ifNotExists: true,
  });

  // Create submissions table
  await db.createTable(
    submissionsTable,
    [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'data', type: 'TEXT', notNull: true }, // JSON object
      { name: 'idempotency_key', type: 'TEXT' },
      { name: 'ip', type: 'TEXT' },
      { name: 'meta', type: 'TEXT' }, // JSON {ua, referrer, geo}
      { name: 'dup_count', type: 'INTEGER', notNull: true, default: 0 },
      { name: 'last_seen_at', type: 'INTEGER' },
      { name: 'created_at', type: 'INTEGER', notNull: true },
    ],
    { ifNotExists: true }
  );

  // Create indexes for efficient lookups
  await db.createIndex(`idx_${submissionsTable}_idempotency`, submissionsTable, ['idempotency_key'], {
    unique: true,
    ifNotExists: true,
  });

  await db.createIndex(`idx_${submissionsTable}_created_at`, submissionsTable, ['created_at'], {
    ifNotExists: true,
  });
}

/**
 * Drop per-app tables when app is deleted.
 * Safe to call even if tables don't exist.
 * 
 * @param db - Database connection
 * @param slug - App slug
 */
export async function dropAppTables(db: Database, slug: string): Promise<void> {
  const schemaTable = getSchemaFieldsTableName(slug);
  const submissionsTable = getSubmissionsTableName(slug);

  try {
    await db.exec(`DROP TABLE IF EXISTS ${schemaTable}`);
    await db.exec(`DROP TABLE IF EXISTS ${submissionsTable}`);
  } catch (err) {
    // Silently fail on cleanup - tables may not exist
  }
}
