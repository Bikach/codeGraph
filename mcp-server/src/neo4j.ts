/**
 * Neo4j Client for CodeGraph
 *
 * Wrapper around the official Neo4j driver with:
 * - Connection management
 * - Helper for Cypher queries
 * - Transaction management
 * - TypeScript typing for results
 */

import neo4j, {
  Driver,
  ManagedTransaction,
  Record as Neo4jRecord,
  Neo4jError,
} from 'neo4j-driver';

/**
 * Query options
 */
export interface QueryOptions {
  /**
   * Database to use (default: neo4j)
   */
  database?: string;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Result record type
 */
export type ResultRecord = { [key: string]: any };

/**
 * Neo4j client with simplified API
 */
export class Neo4jClient {
  private driver: Driver | null = null;
  private uri: string;
  private user: string;
  private password: string;

  constructor(uri: string, user: string, password: string) {
    this.uri = uri;
    this.user = user;
    this.password = password;
  }

  /**
   * Establish connection to Neo4j and verify connectivity
   */
  async connect(): Promise<void> {
    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.password),
      {
        // Configuration optimized for reading
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        disableLosslessIntegers: true,
        maxTransactionRetryTime: 30000,
        connectionTimeout: 30000,
      }
    );

    // Verify connection
    await this.driver.verifyConnectivity();
  }

  /**
   * Close the Neo4j connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  /**
   * Execute a read-only Cypher query
   *
   * @param cypher Cypher query
   * @param parameters Query parameters
   * @param options Query options
   * @returns Query results
   *
   * @example
   * const results = await client.query(
   *   'MATCH (c:Class {name: $name}) RETURN c',
   *   { name: 'MyClass' }
   * );
   */
  async query<T = ResultRecord>(
    cypher: string,
    parameters: { [key: string]: any } = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }

    const session = this.driver.session({
      database: options.database || 'neo4j',
      defaultAccessMode: neo4j.session.READ,
    });

    try {
      const result = await session.run(cypher, parameters, {
        timeout: options.timeout,
      });

      return result.records.map((record) => this.recordToObject<T>(record));
    } catch (error) {
      if (error instanceof Neo4jError) {
        throw new Error(`Neo4j query error: ${error.message} (code: ${error.code})`);
      }
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write Cypher query
   *
   * @param cypher Cypher query
   * @param parameters Query parameters
   * @param options Query options
   * @returns Query results
   *
   * @example
   * await client.write(
   *   'CREATE (c:Class {name: $name}) RETURN c',
   *   { name: 'NewClass' }
   * );
   */
  async write<T = ResultRecord>(
    cypher: string,
    parameters: { [key: string]: any } = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }

    const session = this.driver.session({
      database: options.database || 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      const result = await session.run(cypher, parameters, {
        timeout: options.timeout,
      });

      return result.records.map((record) => this.recordToObject<T>(record));
    } catch (error) {
      if (error instanceof Neo4jError) {
        throw new Error(`Neo4j write error: ${error.message} (code: ${error.code})`);
      }
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute multiple queries in a read transaction
   *
   * @param fn Function containing queries to execute
   * @param options Transaction options
   * @returns Function result
   *
   * @example
   * const result = await client.executeReadTransaction(async (tx) => {
   *   const result = await tx.run('MATCH (c:Class {name: $name}) RETURN c', { name: 'MyClass' });
   *   return result.records;
   * });
   */
  async executeReadTransaction<T>(
    fn: (tx: ManagedTransaction) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }

    const session = this.driver.session({
      database: options.database || 'neo4j',
      defaultAccessMode: neo4j.session.READ,
    });

    try {
      return await session.executeRead((tx) => fn(tx));
    } finally {
      await session.close();
    }
  }

  /**
   * Execute multiple queries in a write transaction
   *
   * @param fn Function containing queries to execute
   * @param options Transaction options
   * @returns Function result
   *
   * @example
   * await client.executeWriteTransaction(async (tx) => {
   *   await tx.run('CREATE (c:Class {name: $name})', { name: 'Class1' });
   *   await tx.run('CREATE (c:Class {name: $name})', { name: 'Class2' });
   * });
   */
  async executeWriteTransaction<T>(
    fn: (tx: ManagedTransaction) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }

    const session = this.driver.session({
      database: options.database || 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      return await session.executeWrite((tx) => fn(tx));
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a simple one-off query using driver.executeQuery
   *
   * @param cypher Cypher query
   * @param parameters Query parameters
   * @param options Query options
   * @returns Query results
   *
   * @example
   * const results = await client.executeQuery(
   *   'MATCH (c:Class {name: $name}) RETURN c',
   *   { name: 'MyClass' }
   * );
   */
  async executeQuery<T = ResultRecord>(
    cypher: string,
    parameters: { [key: string]: any } = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected. Call connect() first.');
    }

    try {
      const result = await this.driver.executeQuery(cypher, parameters, {
        database: options.database || 'neo4j',
      });

      return result.records.map((record) => this.recordToObject<T>(record));
    } catch (error) {
      if (error instanceof Neo4jError) {
        throw new Error(`Neo4j executeQuery error: ${error.message} (code: ${error.code})`);
      }
      throw error;
    }
  }

  /**
   * Convert a Neo4j Record to a JavaScript object
   *
   * @param record Neo4j Record
   * @returns JavaScript object
   */
  private recordToObject<T>(record: Neo4jRecord): T {
    const obj: { [key: string]: any } = {};

    record.keys.forEach((key) => {
      const value = record.get(key);
      obj[key as string] = this.convertValue(value);
    });

    return obj as T;
  }

  /**
   * Convert Neo4j types to native JavaScript types
   *
   * @param value Neo4j value
   * @returns JavaScript value
   */
  private convertValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Neo4j Node -> object with properties
    if (neo4j.isNode(value)) {
      return {
        elementId: value.elementId,
        labels: value.labels,
        properties: value.properties,
      };
    }

    // Neo4j Relationship -> object with properties
    if (neo4j.isRelationship(value)) {
      return {
        elementId: value.elementId,
        type: value.type,
        startNodeElementId: value.startNodeElementId,
        endNodeElementId: value.endNodeElementId,
        properties: value.properties,
      };
    }

    // Neo4j Path -> structured object
    if (neo4j.isPath(value)) {
      return {
        start: this.convertValue(value.start),
        end: this.convertValue(value.end),
        segments: value.segments.map((segment) => ({
          start: this.convertValue(segment.start),
          relationship: this.convertValue(segment.relationship),
          end: this.convertValue(segment.end),
        })),
      };
    }

    // Neo4j Integer -> number
    if (neo4j.isInt(value)) {
      return value.toNumber();
    }

    // Neo4j Temporal types -> ISO string
    if (neo4j.isDateTime(value) || neo4j.isDate(value) || neo4j.isTime(value)) {
      return value.toString();
    }

    // Array -> convert recursively
    if (Array.isArray(value)) {
      return value.map((item) => this.convertValue(item));
    }

    // Object -> convert recursively
    if (typeof value === 'object') {
      const obj: { [key: string]: any } = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          obj[key] = this.convertValue(value[key]);
        }
      }
      return obj;
    }

    return value;
  }

  /**
   * Check if connection is active
   */
  isConnected(): boolean {
    return this.driver !== null;
  }

  /**
   * Return driver statistics
   */
  getDriverMetrics() {
    if (!this.driver) {
      return null;
    }

    return {
      connected: true,
    };
  }
}
