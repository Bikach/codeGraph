/**
 * GraphWriteStore — code graph ingestion abstraction (Phase 5 of PLAN.md §6.3).
 *
 * Write counterpart of `GraphStore`. Kept SEPARATE (ISP): MCP tools only read (GraphStore),
 * the indexer only writes (GraphWriteStore). A future EmbeddedStore may implement both on the
 * same backend.
 *
 * Coarse-grained on purpose: `writeFiles` takes resolved domain files and the persistence
 * strategy (e.g. per-node MERGE vs batch COPY) stays entirely inside the implementation — no
 * write Cypher leaks above this interface.
 */

import type { ResolvedFile } from '../../indexer/types.js';
import type { GraphDomainAnalysis } from '../../indexer/domain/index.js';

/** Result of a write operation. */
export interface WriteResult {
  nodesCreated: number;
  relationshipsCreated: number;
  filesProcessed: number;
  errors: WriteError[];
}

/** Error encountered during a write operation. */
export interface WriteError {
  filePath: string;
  message: string;
  details?: string;
}

/** Options for ingestion. */
export interface WriterOptions {
  /** Batch size for bulk operations. */
  batchSize?: number;
  /** Clear existing data before writing. */
  clearBefore?: boolean;
  /** Create the storage schema if missing. */
  ensureSchema?: boolean;
  /** Enable domain analysis and writing. */
  analyzeDomains?: boolean;
  /** Path to codegraph.domains.json for domain configuration. */
  domainsConfigPath?: string;
  /** Absolute path to the project being indexed (multi-project support). */
  projectPath?: string;
  /** Human-readable project name (defaults to the directory name). */
  projectName?: string;
}

/** Result of clearing the graph. */
export interface ClearResult {
  nodesDeleted: number;
  relationshipsDeleted: number;
}

export interface GraphWriteStore {
  /** Create the storage schema (embedded backend: CREATE NODE/REL TABLE). */
  ensureSchema(): Promise<void>;

  /** Clear the graph (everything, or a single project by its path). */
  clearGraph(projectPath?: string): Promise<ClearResult>;

  /** Ingest resolved files into the graph (schema/clear handled via options when requested). */
  writeFiles(files: ResolvedFile[], options?: WriterOptions): Promise<WriteResult>;

  /** Persist the global domain analysis (named domains + weighted cross-domain deps). Call after writeFiles. */
  writeDomains(
    analysis: GraphDomainAnalysis,
    projectPath: string
  ): Promise<{ domainsCreated: number; dependenciesCreated: number }>;
}
