import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetNeighborsParams, NeighborResult } from './types.js';

const formatNeighbor = (n: NeighborResult) =>
  `${n.direction} | ${n.depth} | ${n.type} | ${n.name}${n.filePath ? ` | ${n.filePath}` : ''}`;

interface NeighborRecord {
  name: string;
  type: string;
  direction: 'outgoing' | 'incoming';
  depth: number;
  filePath: string | null;
}

export async function handleGetNeighbors(
  client: Neo4jClient,
  params: GetNeighborsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name, direction = 'both', depth = 1, include_external = false } = params;

  const neighbors: NeighborResult[] = [];

  // Query for outgoing dependencies (what this node depends on)
  if (direction === 'outgoing' || direction === 'both') {
    const outgoingCypher = `
      MATCH (source)-[:USES|EXTENDS|IMPLEMENTS*1..${depth}]->(target)
      WHERE source.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface OR target:Object)
        ${include_external ? '' : 'AND target.filePath IS NOT NULL'}
      RETURN DISTINCT
        target.name AS name,
        [label IN labels(target) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'outgoing' AS direction,
        1 AS depth,
        target.filePath AS filePath
      ORDER BY type, name
    `;

    const outgoing = await client.query<NeighborRecord>(outgoingCypher, { node_name });
    neighbors.push(
      ...outgoing.map((r) => ({
        name: r.name,
        type: r.type,
        direction: r.direction,
        depth: r.depth,
        filePath: r.filePath ?? undefined,
      }))
    );
  }

  // Query for incoming dependents (what depends on this node)
  if (direction === 'incoming' || direction === 'both') {
    const incomingCypher = `
      MATCH (source)-[:USES|EXTENDS|IMPLEMENTS*1..${depth}]->(target)
      WHERE target.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface OR target:Object)
        ${include_external ? '' : 'AND source.filePath IS NOT NULL'}
      RETURN DISTINCT
        source.name AS name,
        [label IN labels(source) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'incoming' AS direction,
        1 AS depth,
        source.filePath AS filePath
      ORDER BY type, name
    `;

    const incoming = await client.query<NeighborRecord>(incomingCypher, { node_name });
    neighbors.push(
      ...incoming.map((r) => ({
        name: r.name,
        type: r.type,
        direction: r.direction as 'incoming',
        depth: r.depth,
        filePath: r.filePath ?? undefined,
      }))
    );
  }

  const text = buildCompactOutput('NEIGHBORS', neighbors, formatNeighbor);

  return {
    content: [{ type: 'text', text }],
  };
}
