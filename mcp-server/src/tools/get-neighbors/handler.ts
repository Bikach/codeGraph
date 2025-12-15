import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetNeighborsParams, NeighborResult } from './types.js';

const formatNeighbor = (n: NeighborResult) =>
  `${n.direction} | ${n.depth} | ${n.type} | ${n.name}${n.filePath ? ` | ${n.filePath}` : ''}`;

export async function handleGetNeighbors(
  _client: Neo4jClient,
  params: GetNeighborsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name: _node_name, direction: _direction = 'both', depth: _depth = 1, include_external: _include_external = false } = params;

  // TODO: Implement Neo4j query
  // For outgoing (dependencies):
  // MATCH (c {name: $node_name})-[:USES|EXTENDS|IMPLEMENTS*1..$depth]->(dep)
  // For incoming (dependents):
  // MATCH (dependent)-[:USES|EXTENDS|IMPLEMENTS*1..$depth]->(c {name: $node_name})

  const neighbors: NeighborResult[] = [];

  const text = buildCompactOutput('NEIGHBORS', neighbors, formatNeighbor);

  return {
    content: [{ type: 'text', text }],
  };
}
