import { MesahubClient, parseMesahubUrl } from '@mesahub/client';
import type { DatabaseHandle } from '@mesahub/client';
import config from './config.js';

const { apiUrl, apiKey, dbName, routePrefix } = parseMesahubUrl(config.mesahubUrl);

const client = new MesahubClient({ apiUrl, apiKey, routePrefix });

/**
 * Shared DatabaseHandle — used by all repository implementations.
 * The underlying HTTP client pools connections automatically.
 */
const db: DatabaseHandle = client.db(dbName);

/**
 * Create the global `apps` table on first boot.
 * Safe to run repeatedly (IF NOT EXISTS).
 *
 * Per-app tables (schema fields + submissions) are created on-demand
 * via ITableManager.ensureAppTables().
 */
export async function initializeSchema(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "apps" (
      "id"              TEXT PRIMARY KEY,
      "slug"            TEXT NOT NULL UNIQUE,
      "name"            TEXT NOT NULL,
      "description"     TEXT,
      "api_key"         TEXT NOT NULL UNIQUE,
      "allowed_origins" TEXT NOT NULL DEFAULT '[]',
      "created_at"      INTEGER NOT NULL,
      "updated_at"      INTEGER NOT NULL
    )
  `);

  await db.exec(
    `CREATE INDEX IF NOT EXISTS "idx_apps_slug" ON "apps" ("slug")`,
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_api_key" ON "apps" ("api_key")`,
  );
}

export default db;
