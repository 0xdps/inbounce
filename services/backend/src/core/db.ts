import { Database } from 'sqlite-hub-client';
import connect from 'sqlite-hub-client';
import config from './config.js';

const db: Database = connect({
  url: config.sqliteHubUrl,
  token: config.sqliteHubServiceSecret,
  db: config.sqliteHubDb,
});

/**
 * Create core tables on boot. Safe to run repeatedly (IF NOT EXISTS).
 * 
 * Only creates the global 'apps' table.
 * Schema and submissions tables are per-app and created on-demand (see core/tables.ts).
 */
export async function initializeSchema(): Promise<void> {
  await db.createTable(
    'apps',
    [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'slug', type: 'TEXT', notNull: true, unique: true }, // New: immutable public identifier
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'description', type: 'TEXT' },
      { name: 'api_key', type: 'TEXT', notNull: true, unique: true },
      { name: 'allowed_origins', type: 'TEXT', notNull: true, default: "'[]'" },
      { name: 'created_at', type: 'INTEGER', notNull: true },
    ],
    { ifNotExists: true }
  );

  // Indexes
  await db.createIndex('idx_apps_slug', 'apps', ['slug'], { ifNotExists: true });
  await db.createIndex('idx_apps_api_key', 'apps', ['api_key'], { unique: true, ifNotExists: true });
}

export default db;
