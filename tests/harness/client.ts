import pg from "pg";

const { Client } = pg;

export type SqlParam = string | number | boolean | null | undefined;

export interface SqlFailure {
  code: string;
  message: string;
}

export class Db {
  private readonly client: pg.Client;
  private depth = 0;

  constructor(client: pg.Client) {
    this.client = client;
  }

  async exec(text: string, params: SqlParam[] = []): Promise<void> {
    await this.client.query(text, params);
  }

  async rows<T extends pg.QueryResultRow>(text: string, params: SqlParam[] = []): Promise<T[]> {
    const result = await this.client.query<T>(text, params);
    return result.rows;
  }

  async maybeOne<T extends pg.QueryResultRow>(text: string, params: SqlParam[] = []): Promise<T | null> {
    const rows = await this.rows<T>(text, params);
    if (rows.length > 1) {
      throw new Error(`Expected at most one row, received ${rows.length}`);
    }
    return rows[0] ?? null;
  }

  async one<T extends pg.QueryResultRow>(text: string, params: SqlParam[] = []): Promise<T> {
    const row = await this.maybeOne<T>(text, params);
    if (row === null) {
      throw new Error("Expected exactly one row, received none");
    }
    return row;
  }

  async scalar<T>(text: string, params: SqlParam[] = []): Promise<T> {
    const row = await this.one<pg.QueryResultRow>(text, params);
    const values = Object.values(row);
    if (values.length !== 1) {
      throw new Error(`Expected exactly one column, received ${values.length}`);
    }
    return values[0] as T;
  }

  async column<T>(text: string, params: SqlParam[] = []): Promise<T[]> {
    const rows = await this.rows<pg.QueryResultRow>(text, params);
    return rows.map((row) => {
      const values = Object.values(row);
      if (values.length !== 1) {
        throw new Error(`Expected exactly one column, received ${values.length}`);
      }
      return values[0] as T;
    });
  }

  async tx<T>(body: (db: Db) => Promise<T>): Promise<T> {
    const savepoint = `sp_${this.depth}`;
    await this.exec(this.depth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
    this.depth += 1;
    try {
      return await body(this);
    } finally {
      this.depth -= 1;
      await this.exec(this.depth === 0 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT ${savepoint}`);
    }
  }

  async failure(text: string, params: SqlParam[] = []): Promise<SqlFailure> {
    const guard = `guard_${this.depth}`;
    const guarded = this.depth > 0;
    if (guarded) {
      await this.exec(`SAVEPOINT ${guard}`);
    }
    try {
      await this.exec(text, params);
    } catch (error) {
      if (guarded) {
        await this.exec(`ROLLBACK TO SAVEPOINT ${guard}`);
      }
      const { code, message } = error as { code?: unknown; message?: unknown };
      return {
        code: typeof code === "string" ? code : "",
        message: typeof message === "string" ? message : String(error),
      };
    }
    if (guarded) {
      await this.exec(`RELEASE SAVEPOINT ${guard}`);
    }
    throw new Error(`Expected the statement to fail but it succeeded: ${text}`);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export const connect = async (config: {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  database: string;
}): Promise<Db> => {
  const client = new Client(config);
  await client.connect();
  return new Db(client);
};
