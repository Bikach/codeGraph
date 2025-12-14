/**
 * Tool Handlers for CodeGraph MCP Server
 *
 * Each handler executes Neo4j queries and returns compact text output
 * optimized for LLM token efficiency (~70% reduction vs JSON).
 */

import { Neo4jClient } from '../neo4j.js';

/**
 * MCP Tool response type
 */
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
};

/**
 * Compact output formatters for token optimization
 *
 * Format convention:
 * - One line per result
 * - Pipe-separated fields
 * - Header line with count
 */
export const formatters = {
  /**
   * Format: "type | Name | visibility | filePath:line"
   */
  classInfo: (c: { name: string; type: string; visibility: string; filePath: string; lineNumber: number }) =>
    `${c.type} | ${c.name} | ${c.visibility} | ${c.filePath}:${c.lineNumber}`,

  /**
   * Format: "depth | Type | Name | filePath"
   */
  dependency: (d: { name: string; type: string; depth: number; filePath?: string }) =>
    `${d.depth} | ${d.type} | ${d.name}${d.filePath ? ` | ${d.filePath}` : ''}`,

  /**
   * Format: "direct/indirect | ClassName | filePath:line"
   */
  implementation: (i: { name: string; filePath: string; lineNumber: number; isDirect: boolean }) =>
    `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`,

  /**
   * Format: "direction:depth | Class.function() | filePath:line"
   */
  callTrace: (t: { functionName: string; className?: string; filePath: string; lineNumber: number; direction: string; depth: number }) =>
    `${t.direction}:${t.depth} | ${t.className ? `${t.className}.` : ''}${t.functionName}() | ${t.filePath}:${t.lineNumber}`,

  /**
   * Format: "type | name | filePath:line"
   */
  searchResult: (r: { name: string; type: string; filePath: string; lineNumber: number }) =>
    `${r.type} | ${r.name} | ${r.filePath}:${r.lineNumber}`,
};

/**
 * Build compact text output for MCP responses
 */
export function buildCompactOutput<T>(
  header: string,
  items: T[],
  formatter: (item: T) => string
): string {
  if (items.length === 0) {
    return `${header}: No results found.`;
  }
  return `${header} (${items.length}):\n${items.map(formatter).join('\n')}`;
}

/**
 * Tool Handler: find_class
 * Output format: "type | Name | visibility | filePath:line"
 */
export async function handleFindClass(
  _client: Neo4jClient,
  _args: { name: string; exact_match: boolean }
): Promise<ToolResponse> {
  // TODO: Implementation with Neo4j query
  // Example query:
  // MATCH (c:Class) WHERE c.name CONTAINS $name OR c.name = $name
  // RETURN c.name, labels(c)[0] as type, c.visibility, c.filePath, c.lineNumber

  const classes: Array<{ name: string; type: string; visibility: string; filePath: string; lineNumber: number }> = [];

  const text = buildCompactOutput('CLASSES', classes, formatters.classInfo);

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Tool Handler: get_dependencies
 * Output format: "depth | Type | Name | filePath"
 */
export async function handleGetDependencies(
  _client: Neo4jClient,
  _args: { class_name: string; depth: number; include_external: boolean }
): Promise<ToolResponse> {
  // TODO: Implementation with Neo4j query
  // Example query:
  // MATCH (c:Class {name: $name})-[:USES|DEPENDS_ON*1..$depth]->(dep)
  // RETURN dep.name, labels(dep)[0] as type, length(path) as depth, dep.filePath

  const dependencies: Array<{ name: string; type: string; depth: number; filePath?: string }> = [];

  const text = buildCompactOutput('DEPENDENCIES', dependencies, formatters.dependency);

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Tool Handler: get_implementations
 * Output format: "direct/indirect | ClassName | filePath:line"
 */
export async function handleGetImplementations(
  _client: Neo4jClient,
  _args: { interface_name: string; include_indirect: boolean }
): Promise<ToolResponse> {
  // TODO: Implementation with Neo4j query
  // Example query:
  // MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface {name: $name})
  // RETURN c.name, c.filePath, c.lineNumber, true as isDirect

  const implementations: Array<{ name: string; filePath: string; lineNumber: number; isDirect: boolean }> = [];

  const text = buildCompactOutput('IMPLEMENTATIONS', implementations, formatters.implementation);

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Tool Handler: trace_calls
 * Output format: "direction:depth | Class.function() | filePath:line"
 */
export async function handleTraceCalls(
  _client: Neo4jClient,
  _args: { function_name: string; class_name?: string; direction: 'callers' | 'callees' | 'both'; depth: number }
): Promise<ToolResponse> {
  // TODO: Implementation with Neo4j query
  // Example query for callers:
  // MATCH (caller:Function)-[:CALLS*1..$depth]->(f:Function {name: $name})
  // RETURN caller.name, caller.className, caller.filePath, caller.lineNumber, 'caller' as direction

  const traces: Array<{ functionName: string; className?: string; filePath: string; lineNumber: number; direction: string; depth: number }> = [];

  const text = buildCompactOutput('CALL TRACES', traces, formatters.callTrace);

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Tool Handler: search_code
 * Output format: "type | name | filePath:line"
 */
export async function handleSearchCode(
  _client: Neo4jClient,
  _args: { query: string; entity_types?: Array<'class' | 'function' | 'property' | 'interface'>; limit: number }
): Promise<ToolResponse> {
  // TODO: Implementation with Neo4j query
  // Example query:
  // MATCH (n) WHERE n.name CONTAINS $query AND labels(n)[0] IN $types
  // RETURN n.name, labels(n)[0] as type, n.filePath, n.lineNumber LIMIT $limit

  const results: Array<{ name: string; type: string; filePath: string; lineNumber: number }> = [];

  const text = buildCompactOutput('SEARCH RESULTS', results, formatters.searchResult);

  return {
    content: [{ type: 'text', text }],
  };
}
