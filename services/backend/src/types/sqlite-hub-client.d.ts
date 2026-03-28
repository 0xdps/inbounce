declare module 'sqlite-hub-client' {
  export interface DatabaseConfig {
    url: string;
    token: string;
    db: string;
  }

  export interface ColumnDefinition {
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
    primaryKey?: boolean;
    notNull?: boolean;
    unique?: boolean;
    default?: string | number;
  }

  export interface TableOptions {
    ifNotExists?: boolean;
  }

  export interface IndexOptions {
    unique?: boolean;
    ifNotExists?: boolean;
  }

  export interface FindOptions {
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }

  export interface RawResult {
    rows?: unknown[];
    changes?: number;
    lastInsertRowid?: number;
  }

  export class Database {
    createTable(
      name: string,
      columns: ColumnDefinition[],
      options?: TableOptions
    ): Promise<void>;

    createIndex(
      name: string,
      table: string,
      columns: string[],
      options?: IndexOptions
    ): Promise<void>;

    insert(table: string, data: Record<string, unknown>): Promise<void>;

    insertMany(table: string, rows: Record<string, unknown>[]): Promise<void>;

    update(
      table: string,
      data: Record<string, unknown>,
      where: Record<string, unknown>
    ): Promise<void>;

    delete(table: string, where: Record<string, unknown>): Promise<void>;

    findOne(
      table: string,
      where: Record<string, unknown>
    ): Promise<Record<string, unknown> | null>;

    find(
      table: string,
      where: Record<string, unknown>,
      options?: FindOptions
    ): Promise<Record<string, unknown>[]>;

    count(table: string, where: Record<string, unknown>): Promise<number>;

    exec(sql: string, params?: unknown[]): Promise<RawResult>;
  }

  export default function connect(config: DatabaseConfig): Database;
}
