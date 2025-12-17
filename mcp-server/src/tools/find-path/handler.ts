import { Neo4jClient } from '../../neo4j/neo4j.js';
import type { FindPathParams, PathStep } from './types.js';

const formatPathStep = (p: PathStep) =>
  `${p.step} | ${p.type} | ${p.name} | ${p.relationship} | ${p.filePath}:${p.lineNumber}`;

interface PathRecord {
  path: {
    start: { labels: string[]; properties: Record<string, unknown> };
    end: { labels: string[]; properties: Record<string, unknown> };
    segments: Array<{
      start: { labels: string[]; properties: Record<string, unknown> };
      relationship: { type: string };
      end: { labels: string[]; properties: Record<string, unknown> };
    }>;
  };
}

export async function handleFindPath(
  client: Neo4jClient,
  params: FindPathParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { from_node, to_node, max_depth = 5, relationship_types } = params;

  // Build relationship type filter
  const relFilter =
    relationship_types && relationship_types.length > 0
      ? `:${relationship_types.join('|')}`
      : '';

  // Use shortestPath to find the path between nodes
  const cypher = `
    MATCH (from), (to)
    WHERE from.name = $from_node AND to.name = $to_node
      AND from <> to
    MATCH path = shortestPath((from)-[${relFilter}*1..${max_depth}]-(to))
    RETURN path
    LIMIT 1
  `;

  const records = await client.query<PathRecord>(cypher, { from_node, to_node });

  if (records.length === 0) {
    return {
      content: [
        { type: 'text', text: `PATH: No path found from "${from_node}" to "${to_node}" within depth ${max_depth}` },
      ],
    };
  }

  const record = records[0];
  if (!record || !record.path) {
    return {
      content: [
        { type: 'text', text: `PATH: No path found from "${from_node}" to "${to_node}" within depth ${max_depth}` },
      ],
    };
  }
  const path = record.path;
  const pathSteps: PathStep[] = [];

  // Build path steps from segments
  // First node (start)
  const startNode = path.start;
  pathSteps.push({
    step: 0,
    type: getNodeType(startNode.labels),
    name: startNode.properties.name as string,
    relationship: '-',
    filePath: (startNode.properties.filePath as string) || '',
    lineNumber: (startNode.properties.lineNumber as number) || 0,
  });

  // Process each segment
  path.segments.forEach((segment, index) => {
    pathSteps.push({
      step: index + 1,
      type: getNodeType(segment.end.labels),
      name: segment.end.properties.name as string,
      relationship: segment.relationship.type,
      filePath: (segment.end.properties.filePath as string) || '',
      lineNumber: (segment.end.properties.lineNumber as number) || 0,
    });
  });

  const text = `PATH (${pathSteps.length} nodes):\n${pathSteps.map(formatPathStep).join('\n')}`;

  return {
    content: [{ type: 'text', text }],
  };
}

function getNodeType(labels: string[]): string {
  const typeLabels = ['Class', 'Interface', 'Function', 'Property', 'Object', 'Package'];
  const found = labels.find((l) => typeLabels.includes(l));
  return found?.toLowerCase() || 'unknown';
}
