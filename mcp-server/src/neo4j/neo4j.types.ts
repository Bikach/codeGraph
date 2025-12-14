/**
 * Neo4j Client Type Definitions
 *
 * Shared types for Neo4j client operations
 */

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
