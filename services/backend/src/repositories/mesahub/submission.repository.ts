import type { DatabaseHandle } from '@mesahub/client';
import {
  getSubmissionsTableName,
  getQuotedSubmissionsTableName,
} from '../../core/slug.js';
import type {
  SubmissionRow,
  SubmissionStats,
  DistributionRow,
  DistributionOptions,
  ListOptions,
  ISubmissionRepository,
} from '../interfaces.js';

export class MesahubSubmissionRepository implements ISubmissionRepository {
  constructor(private readonly db: DatabaseHandle) {}

  async count(slug: string): Promise<number> {
    const table = getSubmissionsTableName(slug);
    return this.db.table(table).count();
  }

  async findById(slug: string, id: string): Promise<SubmissionRow | null> {
    const table = getSubmissionsTableName(slug);
    const row = await this.db.table(table).findOne({ where: { id } });
    return row as unknown as SubmissionRow | null;
  }

  async findByIdempotencyKey(slug: string, key: string): Promise<SubmissionRow | null> {
    const table = getSubmissionsTableName(slug);
    const row = await this.db.table(table).findOne({ where: { idempotency_key: key } });
    return row as unknown as SubmissionRow | null;
  }

  async list(slug: string, opts: ListOptions): Promise<{ data: SubmissionRow[]; total: number }> {
    const tableName = getQuotedSubmissionsTableName(slug);
    const { page, limit, order, after, filterField, filterValue } = opts;
    const offset = (page - 1) * limit;

    const whereParts: string[] = [];
    const baseParams: (string | number)[] = [];

    if (filterField && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filterField)) {
      whereParts.push(
        `LOWER(CAST(json_extract(data, '$.${filterField}') AS TEXT)) LIKE LOWER(?)`,
      );
      baseParams.push(`%${filterValue ?? ''}%`);
    }
    if (after) {
      whereParts.push('created_at >= ?');
      baseParams.push(after);
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rowResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
        [...baseParams, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) AS n FROM ${tableName} ${whereClause}`,
        baseParams,
      ),
    ]);

    const data = rowResult.rows as unknown as SubmissionRow[];
    const total = Number((countResult.rows[0] as Record<string, number>)?.n ?? 0);
    return { data, total };
  }

  async insert(slug: string, row: SubmissionRow): Promise<void> {
    const table = getSubmissionsTableName(slug);
    await this.db.table(table).insert(row as unknown as Record<string, unknown>);
  }

  async delete(slug: string, id: string): Promise<void> {
    const table = getSubmissionsTableName(slug);
    await this.db.table(table).delete({ where: { id } });
  }

  async deleteAll(slug: string): Promise<void> {
    const tableName = getQuotedSubmissionsTableName(slug);
    // Must use raw SQL — TableHandle.delete() requires a non-empty where clause
    await this.db.exec(`DELETE FROM ${tableName}`);
  }

  async stats(slug: string): Promise<SubmissionStats> {
    const tableName = getQuotedSubmissionsTableName(slug);
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);
    const weekAgo = now - 7 * 86400;
    const monthAgo = now - 30 * 86400;

    const summaryResult = await this.db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS week,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month
       FROM ${tableName}`,
      [todayStart, weekAgo, monthAgo],
    );

    const s = (summaryResult.rows[0] ?? {}) as Record<string, number>;

    const dailyResult = await this.db.query(
      `SELECT
         strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) AS date,
         COUNT(*) AS count
       FROM ${tableName}
       WHERE created_at >= ?
       GROUP BY date
       ORDER BY date ASC`,
      [monthAgo],
    );

    return {
      total: Number(s.total ?? 0),
      today: Number(s.today ?? 0),
      week: Number(s.week ?? 0),
      month: Number(s.month ?? 0),
      daily: (dailyResult.rows as Array<{ date: string; count: number }>).map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
  }

  async distribution(
    slug: string,
    field: string,
    opts: DistributionOptions = {},
  ): Promise<{ total: number; data: DistributionRow[] }> {
    const tableName = getQuotedSubmissionsTableName(slug);
    const limit = Math.min(20, Math.max(1, opts.limit ?? 8));

    const whereParts = [`json_extract(data, '$.${field}') IS NOT NULL`];
    const params: (string | number)[] = [];

    if (opts.after) {
      whereParts.push('created_at >= ?');
      params.push(opts.after);
    }

    const result = await this.db.query(
      `SELECT CAST(json_extract(data, '$.${field}') AS TEXT) AS value, COUNT(*) AS count
       FROM ${tableName}
       WHERE ${whereParts.join(' AND ')}
       GROUP BY value ORDER BY count DESC LIMIT ?`,
      [...params, limit],
    );

    const rows = result.rows as unknown as DistributionRow[];
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return { total, data: rows.map((r) => ({ value: r.value, count: Number(r.count) })) };
  }

  async findUniqueFieldDuplicate(
    slug: string,
    fieldName: string,
    value: string,
  ): Promise<string | null> {
    const tableName = getQuotedSubmissionsTableName(slug);
    const result = await this.db.query(
      `SELECT id FROM ${tableName} WHERE json_extract(data, '$.${fieldName}') = ? LIMIT 1`,
      [value],
    );
    return (result.rows[0] as { id: string } | undefined)?.id ?? null;
  }

  async findCompoundUniqueDuplicate(
    slug: string,
    conditions: Array<{ field: string; value: string }>,
  ): Promise<string | null> {
    const tableName = getQuotedSubmissionsTableName(slug);
    const conditionSql = conditions
      .map((c) => `json_extract(data, '$.${c.field}') = ?`)
      .join(' AND ');
    const params = conditions.map((c) => c.value);
    const result = await this.db.query(
      `SELECT id FROM ${tableName} WHERE ${conditionSql} LIMIT 1`,
      params,
    );
    return (result.rows[0] as { id: string } | undefined)?.id ?? null;
  }

  async incrementDupCount(slug: string, id: string): Promise<void> {
    const tableName = getQuotedSubmissionsTableName(slug);
    await this.db.exec(
      `UPDATE ${tableName} SET dup_count = dup_count + 1, last_seen_at = ? WHERE id = ?`,
      [Math.floor(Date.now() / 1000), id],
    );
  }

  async updateMeta(slug: string, id: string, meta: Record<string, unknown>): Promise<void> {
    const tableName = getQuotedSubmissionsTableName(slug);
    await this.db.exec(`UPDATE ${tableName} SET meta = ? WHERE id = ?`, [
      JSON.stringify(meta),
      id,
    ]);
  }
}
