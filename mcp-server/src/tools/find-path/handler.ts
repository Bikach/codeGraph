import { Neo4jClient } from '../../neo4j/neo4j.js';
import type { FindPathParams, PathStep } from './types.js';

const formatPathStep = (p: PathStep) =>
  `${p.step} | ${p.type} | ${p.name} | ${p.relationship} | ${p.filePath}:${p.lineNumber}`;

export async function handleFindPath(
  _client: Neo4jClient,
  params: FindPathParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { from_node, to_node, max_depth = 5, relationship_types: _relationship_types } = params;

  // TODO: Implement Neo4j query
  // MATCH path = shortestPath((from {name: $from_node})-[*1..$max_depth]-(to {name: $to_node}))
  // WHERE all(r IN relationships(path) WHERE type(r) IN $relationship_types)
  // RETURN nodes(path), relationships(path)

  const pathSteps: PathStep[] = [];

  if (pathSteps.length === 0) {
    return {
      content: [{ type: 'text', text: `PATH: No path found from "${from_node}" to "${to_node}" within depth ${max_depth}` }],
    };
  }

  const text = `PATH (${pathSteps.length} steps):\n${pathSteps.map(formatPathStep).join('\n')}`;

  return {
    content: [{ type: 'text', text }],
  };
}
