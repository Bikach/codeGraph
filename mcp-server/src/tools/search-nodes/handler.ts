import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { SearchNodesParams, NodeResult } from './types.js';

const formatNode = (n: NodeResult) =>
  `${n.type} | ${n.name} | ${n.visibility} | ${n.filePath}:${n.lineNumber}`;

export async function handleSearchNodes(
  _client: Neo4jClient,
  params: SearchNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { query: _query, node_types: _node_types, exact_match: _exact_match = false, limit: _limit = 20 } = params;

  // TODO: Implement Neo4j query
  // Example:
  // const labels = node_types?.map(t => t.charAt(0).toUpperCase() + t.slice(1)) ?? ['Class', 'Interface', 'Function', 'Property', 'Object'];
  // MATCH (n) WHERE any(label IN labels(n) WHERE label IN $labels)
  // AND (n.name = $query OR n.name CONTAINS $query)
  // RETURN n.name, labels(n)[0] as type, n.visibility, n.filePath, n.lineNumber
  // LIMIT $limit

  const results: NodeResult[] = [];

  const text = buildCompactOutput('NODES', results, formatNode);

  return {
    content: [{ type: 'text', text }],
  };
}
