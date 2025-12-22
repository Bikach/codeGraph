/**
 * Project filtering utilities for tools
 *
 * Provides common functionality for filtering query results by project path.
 */

import { Neo4jClient } from '../neo4j/neo4j.js';

/**
 * Result of project validation
 */
export type ProjectValidationResult =
  | { valid: true; projectPath: string }
  | { valid: false; error: string };

/**
 * Validates that a project exists at the given path.
 * Returns an error message if the project is not found.
 *
 * @param client - Neo4j client
 * @param projectPath - Path to validate
 * @returns Validation result with error message if not found
 */
export async function validateProject(
  client: Neo4jClient,
  projectPath: string
): Promise<ProjectValidationResult> {
  const cypher = `
    MATCH (p:Project)
    WHERE $projectPath STARTS WITH p.path
    RETURN p.path AS path, p.name AS name
    LIMIT 1
  `;

  const records = await client.query<{ path: string; name: string }>(cypher, { projectPath });

  if (records.length === 0) {
    return {
      valid: false,
      error: `No indexed project found for path "${projectPath}". The project may have been moved or not yet indexed. Run the indexer to index this project.`,
    };
  }

  return { valid: true, projectPath: records[0]!.path };
}

/**
 * Builds a Cypher WHERE clause fragment for filtering by project path.
 * Uses filePath property which all nodes should have.
 *
 * @param nodeAlias - The alias of the node in the Cypher query (e.g., 'n', 'target')
 * @param paramName - The parameter name to use (default: 'projectPath')
 * @returns Cypher fragment like "AND n.filePath STARTS WITH $projectPath"
 */
export function buildProjectFilter(nodeAlias: string, paramName = 'projectPath'): string {
  return `AND ${nodeAlias}.filePath STARTS WITH $${paramName}`;
}

/**
 * Returns a formatted error response for when a project is not found.
 */
export function projectNotFoundResponse(error: string): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text', text: `ERROR: ${error}` }],
  };
}
