/**
 * Project-related helpers for tools.
 *
 * Project existence is checked via `GraphStore.findProject`; these helpers only build the
 * user-facing "not found" message and its MCP error response.
 */

/**
 * Builds the "project not found" error message (single source of truth).
 */
export function projectNotFoundError(projectPath: string): string {
  return `No indexed project found for path "${projectPath}". The project may have been moved or not yet indexed. Run the indexer to index this project.`;
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
