import type { DatabaseHandle } from '@mesahub/client';
import {
  getSchemaFieldsTableName,
  getQuotedSchemaFieldsTableName,
} from '../../core/slug.js';
import type { SchemaFieldRow, ISchemaRepository } from '../interfaces.js';

export class MesahubSchemaRepository implements ISchemaRepository {
  constructor(private readonly db: DatabaseHandle) {}

  async findByAppSlug(slug: string): Promise<SchemaFieldRow[]> {
    const table = getSchemaFieldsTableName(slug);
    const rows = await this.db.table(table).find({
      orderBy: [{ column: 'position', direction: 'asc' }],
    });
    return rows as unknown as SchemaFieldRow[];
  }

  async replaceAll(slug: string, rows: SchemaFieldRow[]): Promise<SchemaFieldRow[]> {
    const table = getSchemaFieldsTableName(slug);
    const quotedTable = getQuotedSchemaFieldsTableName(slug);

    // Delete all existing fields — must use raw SQL since TableHandle.delete() requires non-empty where
    await this.db.exec(`DELETE FROM ${quotedTable}`);

    if (rows.length > 0) {
      await this.db.table(table).insertMany(rows as unknown as Record<string, unknown>[]);
    }

    return rows;
  }
}
