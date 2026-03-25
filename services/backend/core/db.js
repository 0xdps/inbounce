import connect from 'sqlite-hub-client';
import config from './config.js';
import logger from './logger.js';

const db = connect({
  url:   config.sqliteHubUrl,
  token: config.sqliteHubServiceSecret,
  db:    config.sqliteHubDb,
});

/**
 * Create core tables on boot. Safe to run repeatedly (IF NOT EXISTS).
 */
export async function initializeSchema() {
  await db.createTable('apps', [
    { name: 'id',              type: 'TEXT',    primaryKey: true },
    { name: 'name',            type: 'TEXT',    notNull: true },
    { name: 'description',     type: 'TEXT' },
    { name: 'api_key',         type: 'TEXT',    notNull: true, unique: true },
    { name: 'allowed_origins', type: 'TEXT',    notNull: true, default: "'[]'" },
    { name: 'created_at',      type: 'INTEGER', notNull: true },
  ], { ifNotExists: true });

  await db.createTable('schema_fields', [
    { name: 'id',       type: 'TEXT',    primaryKey: true },
    { name: 'app_id',   type: 'TEXT',    notNull: true },
    { name: 'name',     type: 'TEXT',    notNull: true },
    { name: 'type',     type: 'TEXT',    notNull: true },
    { name: 'required', type: 'INTEGER', notNull: true, default: 0 },
    { name: 'unique',   type: 'INTEGER', notNull: true, default: 0 },
    { name: 'position', type: 'INTEGER', notNull: true, default: 0 },
  ], { ifNotExists: true });

  await db.createTable('submissions', [
    { name: 'id',               type: 'TEXT',    primaryKey: true },
    { name: 'app_id',           type: 'TEXT',    notNull: true },
    { name: 'data',             type: 'TEXT',    notNull: true },
    { name: 'idempotency_key',  type: 'TEXT' },
    { name: 'ip',               type: 'TEXT' },
    { name: 'meta',             type: 'TEXT' },
    { name: 'created_at',       type: 'INTEGER', notNull: true },
  ], { ifNotExists: true });

  // Migration: add meta column to existing tables that predate this column
  try {
    await db.exec('ALTER TABLE submissions ADD COLUMN meta TEXT');
  } catch (_) {
    // Column already exists — safe to ignore
  }

  await db.createIndex('idx_submissions_app_id',      'submissions',    ['app_id'],           { ifNotExists: true });
  await db.createIndex('idx_submissions_idempotency', 'submissions',    ['idempotency_key'],  { unique: true, ifNotExists: true });
  await db.createIndex('idx_schema_fields_app_id',    'schema_fields',  ['app_id'],           { ifNotExists: true });
  await db.createIndex('idx_apps_api_key',            'apps',           ['api_key'],          { unique: true, ifNotExists: true });
}

export default db;
