import type { DatabaseHandle } from '@mesahub/client';
import { getSubmissionsTableName } from '../../core/slug.js';
import type { App, IAppRepository } from '../interfaces.js';

export class MesahubAppRepository implements IAppRepository {
  constructor(private readonly db: DatabaseHandle) {}

  async findAll(): Promise<App[]> {
    const rows = await this.db.table('apps').find({
      orderBy: [{ column: 'created_at', direction: 'desc' }],
    });
    return rows as unknown as App[];
  }

  async findBySlug(slug: string): Promise<App | null> {
    const row = await this.db.table('apps').findOne({ where: { slug } });
    return row as unknown as App | null;
  }

  async findByApiKey(apiKey: string): Promise<App | null> {
    const row = await this.db.table('apps').findOne({ where: { api_key: apiKey } });
    return row as unknown as App | null;
  }

  async create(app: App): Promise<void> {
    await this.db.table('apps').insert(app as unknown as Record<string, unknown>);
  }

  async update(id: string, data: Partial<App>): Promise<void> {
    await this.db.table('apps').update({ where: { id }, set: data as Record<string, unknown> });
  }

  async delete(id: string): Promise<void> {
    await this.db.table('apps').delete({ where: { id } });
  }

  async submissionCount(slug: string): Promise<number> {
    const table = getSubmissionsTableName(slug);
    return this.db.table(table).count();
  }
}
