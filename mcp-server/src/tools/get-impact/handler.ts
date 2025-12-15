import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetImpactParams, ImpactResult } from './types.js';

const formatImpact = (i: ImpactResult) =>
  `${i.impactType} | ${i.depth} | ${i.type} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

export async function handleGetImpact(
  _client: Neo4jClient,
  params: GetImpactParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name: _node_name, node_type: _node_type, depth: _depth = 3 } = params;

  // TODO: Implement Neo4j query
  // Impact analysis combines multiple traversals:
  // 1. Callers: MATCH (caller:Function)-[:CALLS*1..$depth]->(f {name: $node_name})
  // 2. Dependents: MATCH (dep)-[:USES*1..$depth]->(n {name: $node_name})
  // 3. Implementors: MATCH (impl)-[:IMPLEMENTS*1..$depth]->(n {name: $node_name})
  // 4. Children: MATCH (child)-[:EXTENDS*1..$depth]->(n {name: $node_name})

  const impacts: ImpactResult[] = [];

  const text = buildCompactOutput('IMPACT ANALYSIS', impacts, formatImpact);

  return {
    content: [{ type: 'text', text }],
  };
}
