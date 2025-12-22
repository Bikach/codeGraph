/**
 * Neo4j Writer Types
 *
 * Type definitions for the Neo4j graph writer.
 */

// =============================================================================
// Write Result Types
// =============================================================================

/**
 * Result of a write operation.
 */
export interface WriteResult {
  /** Number of nodes created in the database */
  nodesCreated: number;
  /** Number of relationships created in the database */
  relationshipsCreated: number;
  /** Number of files successfully processed */
  filesProcessed: number;
  /** Errors encountered during writing */
  errors: WriteError[];
}

/**
 * Error encountered during write operation.
 */
export interface WriteError {
  /** File path where the error occurred */
  filePath: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: string;
}

// =============================================================================
// Writer Options
// =============================================================================

/**
 * Options for the Neo4jWriter.
 */
export interface WriterOptions {
  /** Batch size for UNWIND operations (default: 100) */
  batchSize?: number;
  /** Clear existing data before writing (default: false) */
  clearBefore?: boolean;
  /** Create constraints and indexes if missing (default: true) */
  ensureSchema?: boolean;
  /** Enable domain analysis and writing (default: true) */
  analyzeDomains?: boolean;
  /** Path to codegraph.domains.json for domain configuration */
  domainsConfigPath?: string;
  /** Absolute path to the project being indexed (used for multi-project support) */
  projectPath?: string;
  /** Human-readable project name (defaults to directory name if not provided) */
  projectName?: string;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Result of clearing the graph.
 */
export interface ClearResult {
  nodesDeleted: number;
  relationshipsDeleted: number;
}

/**
 * Internal result for node/relationship counting.
 */
export interface NodeRelResult {
  nodesCreated: number;
  relationshipsCreated: number;
}
