/**
 * EmbeddedConnection — owns the LadybugDB Database/Connection lifecycle and the shared `query`/`run`
 * primitives. The reader and writer receive ONE instance so they operate on the same file (and, in
 * tests, the same in-memory database). Lifecycle + run() moved verbatim from embedded-store.ts.
 *
 * LadybugDB = maintained Cypher fork of Kuzu (`@ladybugdb/core`). In-memory when no path given.
 */

import { Database, Connection } from '@ladybugdb/core';
import type { QueryResult, LbugValue } from '@ladybugdb/core';

export class EmbeddedConnection {
  private db?: Database;
  private conn?: Connection;

  /**
   * @param dbPath  on-disk file; omit for an in-memory database (used by tests).
   * @param options.readOnly  open the file read-only (server reads; refuses to create an empty DB).
   */
  constructor(
    private readonly dbPath?: string,
    private readonly options: { readOnly?: boolean } = {}
  ) {}

  async open(): Promise<void> {
    // Positional ctor: (path, bufferManagerSize, enableCompression, readOnly, maxDBSize, ...).
    if (this.dbPath) {
      // Cap maxDBSize on-disk too. LadybugDB otherwise reserves its 8 TiB default of VIRTUAL address
      // space PER open; the server opens read-only PER REQUEST, so repeated 8 TiB reservations
      // exhaust the virtual space → "Mmap for size 8796093022208 failed". 16 GiB is far beyond any
      // real code graph while keeping each reservation bounded.
      const MAX_DB_SIZE = 2 ** 34; // 16 GiB (power of two)
      this.db = new Database(this.dbPath, undefined, undefined, this.options.readOnly ?? false, MAX_DB_SIZE);
    } else {
      // In-memory: always read-write, and cap maxDBSize. LadybugDB otherwise reserves its 8 TiB
      // default of VIRTUAL address space per instance; creating many in-memory DBs (tests)
      // exhausts mmap and throws "Mmap for size 8796093022208 failed". 1 GiB is ample here.
      const MAX_DB_SIZE = 1 << 30; // 1 GiB (must be a power of two)
      this.db = new Database(':memory:', undefined, undefined, false, MAX_DB_SIZE);
    }
    this.conn = new Connection(this.db);
  }

  async close(): Promise<void> {
    await this.conn?.close();
    await this.db?.close();
    this.conn = undefined;
    this.db = undefined;
  }

  private connection(): Connection {
    if (!this.conn) throw new Error('EmbeddedStore: call open() before use');
    return this.conn;
  }

  /** Raw query (no params) — used for schema DDL. */
  query(statement: string): Promise<QueryResult | QueryResult[]> {
    return this.connection().query(statement);
  }

  /** Run a query (parameterized via prepare/execute) and return the first result. */
  async run(statement: string, params?: Record<string, LbugValue>): Promise<QueryResult> {
    const conn = this.connection();
    const result = params
      ? await conn.execute(await conn.prepare(statement), params)
      : await conn.query(statement);
    return Array.isArray(result) ? result[0]! : result;
  }
}
