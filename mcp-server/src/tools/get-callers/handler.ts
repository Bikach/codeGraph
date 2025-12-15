import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetCallersParams, CallerResult } from './types.js';

const formatCaller = (c: CallerResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}`;

export async function handleGetCallers(
  _client: Neo4jClient,
  params: GetCallersParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name: _function_name, class_name: _class_name, depth: _depth = 2 } = params;

  // TODO: Implement Neo4j query
  // MATCH (caller:Function)-[:CALLS*1..$depth]->(f:Function {name: $function_name})
  // WHERE ($class_name IS NULL OR f.className = $class_name)
  // RETURN caller.name, caller.className, caller.filePath, caller.lineNumber, length(path) as depth

  const callers: CallerResult[] = [];

  const text = buildCompactOutput('CALLERS', callers, formatCaller);

  return {
    content: [{ type: 'text', text }],
  };
}
