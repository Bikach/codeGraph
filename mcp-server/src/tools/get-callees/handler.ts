import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetCalleesParams, CalleeResult } from './types.js';

const formatCallee = (c: CalleeResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}`;

export async function handleGetCallees(
  _client: Neo4jClient,
  params: GetCalleesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name: _function_name, class_name: _class_name, depth: _depth = 2 } = params;

  // TODO: Implement Neo4j query
  // MATCH (f:Function {name: $function_name})-[:CALLS*1..$depth]->(callee:Function)
  // WHERE ($class_name IS NULL OR f.className = $class_name)
  // RETURN callee.name, callee.className, callee.filePath, callee.lineNumber, length(path) as depth

  const callees: CalleeResult[] = [];

  const text = buildCompactOutput('CALLEES', callees, formatCallee);

  return {
    content: [{ type: 'text', text }],
  };
}
