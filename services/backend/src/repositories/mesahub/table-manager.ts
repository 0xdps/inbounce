import type { DatabaseHandle } from '@mesahub/client';
import {
  getSchemaFieldsTableName,
  getSubmissionsTableName,
} from '../../core/slug.js';
import type { ITableManager } from '../interfaces.js';

export class MesahubTableManager implements ITableManager {
  constructor(private readonly db: DatabaseHandle) {}

  async ensureAppTables(slug: string): Promise<void> {
    const schemaTable = getSchemaFieldsTableName(slug);
    const submissionsTable = getSubmissionsTableName(slug);

    await this.db.exec(`
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

    await this.db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaTable}_position" ON "${schemaTable}" ("position")`,
    );

    await this.db.exec(`
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

    await this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${submissionsTable}_idempotency" ON "${submissionsTable}" ("idempotency_key")`,
    );

    await this.db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${submissionsTable}_created_at" ON "${submissionsTable}" ("created_at")`,
    );
  }

  async dropAppTables(slug: string): Promise<void> {
    const schemaTable = getSchemaFieldsTableName(slug);
    const submissionsTable = getSubmissionsTableName(slug);

    try {
      await this.db.exec(`DROP TABLE IF EXISTS "${schemaTable}"`);
      await this.db.exec(`DROP TABLE IF EXISTS "${submissionsTable}"`);
    } catch {
      // Silently ignore — tables may not exist
    }
  }
}
