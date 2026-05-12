/**
 * Repository interfaces for Inbounce data layer.
 *
 * These interfaces decouple the application from any specific storage backend
 * (MesaHub/SQLite today, Postgres/MongoDB tomorrow).
 *
 * Concrete implementations live under ./mesahub/.
 */

// ---------------------------------------------------------------------------
// Shared row types (plain objects, no storage-specific types)
// ---------------------------------------------------------------------------

export interface App {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  api_key: string;
  /** Raw JSON string — `string[]` serialised. */
  allowed_origins: string;
  created_at: number;
  updated_at: number;
}

export interface SchemaFieldRow {
  id: string;
  name: string;
  type: string;
  /** Stored as 0 | 1 (SQLite INTEGER). Truthy/falsy evaluation is safe. */
  required: number;
  /** Stored as 0 | 1 (SQLite INTEGER). Truthy/falsy evaluation is safe. */
  unique: number;
  position: number;
  compound_key: string | null;
  created_at: number;
  updated_at: number;
}

export interface SubmissionRow {
  id: string;
  /** JSON-serialised form payload. */
  data: string;
  idempotency_key: string | null;
  ip: string | null;
  /** JSON-serialised metadata object. */
  meta: string | null;
  dup_count: number;
  last_seen_at: number | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Query option types
// ---------------------------------------------------------------------------

export interface ListOptions {
  page: number;
  limit: number;
  order: 'ASC' | 'DESC';
  after?: number | null;
  filterField?: string | null;
  filterValue?: string | null;
}

export interface DistributionOptions {
  limit?: number;
  after?: number | null;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface DailyStat {
  date: string;
  count: number;
}

export interface SubmissionStats {
  total: number;
  today: number;
  week: number;
  month: number;
  daily: DailyStat[];
}

export interface DistributionRow {
  value: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Repository interfaces
// ---------------------------------------------------------------------------

export interface IAppRepository {
  findAll(): Promise<App[]>;
  findBySlug(slug: string): Promise<App | null>;
  findByApiKey(apiKey: string): Promise<App | null>;
  create(app: App): Promise<void>;
  update(id: string, data: Partial<App>): Promise<void>;
  delete(id: string): Promise<void>;
  submissionCount(slug: string): Promise<number>;
}

export interface ISchemaRepository {
  /**
   * Fetch all schema fields for an app, ordered by position ascending.
   */
  findByAppSlug(slug: string): Promise<SchemaFieldRow[]>;
  /**
   * Atomically replace all schema fields for an app.
   * Returns the persisted rows.
   */
  replaceAll(slug: string, rows: SchemaFieldRow[]): Promise<SchemaFieldRow[]>;
}

export interface ISubmissionRepository {
  count(slug: string): Promise<number>;
  findById(slug: string, id: string): Promise<SubmissionRow | null>;
  findByIdempotencyKey(slug: string, key: string): Promise<SubmissionRow | null>;
  list(slug: string, opts: ListOptions): Promise<{ data: SubmissionRow[]; total: number }>;
  insert(slug: string, row: SubmissionRow): Promise<void>;
  delete(slug: string, id: string): Promise<void>;
  deleteAll(slug: string): Promise<void>;
  stats(slug: string): Promise<SubmissionStats>;
  distribution(
    slug: string,
    field: string,
    opts?: DistributionOptions,
  ): Promise<{ total: number; data: DistributionRow[] }>;
  /** Returns the `id` of the first duplicate row, or `null` if none. */
  findUniqueFieldDuplicate(slug: string, fieldName: string, value: string): Promise<string | null>;
  /** Returns the `id` of the first compound-unique duplicate row, or `null` if none. */
  findCompoundUniqueDuplicate(
    slug: string,
    conditions: Array<{ field: string; value: string }>,
  ): Promise<string | null>;
  incrementDupCount(slug: string, id: string): Promise<void>;
  /** Merge-update the `meta` JSON column for a submission. */
  updateMeta(slug: string, id: string, meta: Record<string, unknown>): Promise<void>;
}

export interface ITableManager {
  /** Idempotently create per-app schema + submission tables. */
  ensureAppTables(slug: string): Promise<void>;
  /** Drop per-app tables when an app is deleted. */
  dropAppTables(slug: string): Promise<void>;
}
