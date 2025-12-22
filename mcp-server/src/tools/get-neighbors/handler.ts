import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
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
  const { node_name, direction = 'both', depth: _depth = 1, include_external = false, project_path } = params;
  // Note: depth parameter reserved for future multi-hop traversal

  // Validate project if project_path is provided
  if (project_path) {
    const validation = await validateProject(client, project_path);
    if (!validation.valid) {
      return projectNotFoundResponse(validation.error);
    }
  }

  // Build project filter clause
  // For both directions, we filter on source.filePath because:
  // - Outgoing: source is the node we're studying (must be in project)
  // - Incoming: source is the dependent (must be in project to be relevant)
  const projectFilterSource = project_path ? 'AND source.filePath STARTS WITH $projectPath' : '';

  const neighbors: NeighborResult[] = [];

  // Query for outgoing dependencies (what this node depends on)
  if (direction === 'outgoing' || direction === 'both') {
    // 1. Direct class-level relationships (EXTENDS, IMPLEMENTS)
    const directOutgoingCypher = `
      MATCH (source)-[:EXTENDS|IMPLEMENTS]->(target)
      WHERE source.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface)
        ${include_external ? '' : 'AND target.filePath IS NOT NULL'}
        ${projectFilterSource}
      RETURN DISTINCT
        target.name AS name,
        [label IN labels(target) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'outgoing' AS direction,
        1 AS depth,
        target.filePath AS filePath
    `;

    // 2. Function-level USES: classes used by functions declared in this class
    const functionUsesOutgoingCypher = `
      MATCH (source)-[:DECLARES]->(f:Function)-[:USES]->(target)
      WHERE source.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface)
        AND source <> target
        ${include_external ? '' : 'AND target.filePath IS NOT NULL'}
        ${projectFilterSource}
      RETURN DISTINCT
        target.name AS name,
        [label IN labels(target) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'outgoing' AS direction,
        1 AS depth,
        target.filePath AS filePath
    `;

    const [directOutgoing, functionUsesOutgoing] = await Promise.all([
      client.query<NeighborRecord>(directOutgoingCypher, { node_name, projectPath: project_path ?? '' }),
      client.query<NeighborRecord>(functionUsesOutgoingCypher, { node_name, projectPath: project_path ?? '' }),
    ]);

    // Combine and dedupe
    const outgoingMap = new Map<string, NeighborRecord>();
    [...directOutgoing, ...functionUsesOutgoing].forEach((r) => {
      if (!outgoingMap.has(r.name)) {
        outgoingMap.set(r.name, r);
      }
    });

    neighbors.push(
      ...Array.from(outgoingMap.values()).map((r) => ({
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
    // 1. Direct class-level relationships (classes that EXTEND or IMPLEMENT this node)
    const directIncomingCypher = `
      MATCH (source)-[:EXTENDS|IMPLEMENTS]->(target)
      WHERE target.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface)
        ${include_external ? '' : 'AND source.filePath IS NOT NULL'}
        ${projectFilterSource}
      RETURN DISTINCT
        source.name AS name,
        [label IN labels(source) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'incoming' AS direction,
        1 AS depth,
        source.filePath AS filePath
    `;

    // 2. Function-level USES: classes whose functions use this class
    const functionUsesIncomingCypher = `
      MATCH (source)-[:DECLARES]->(f:Function)-[:USES]->(target)
      WHERE target.name = $node_name
        AND (source:Class OR source:Interface OR source:Object)
        AND (target:Class OR target:Interface)
        AND source <> target
        ${include_external ? '' : 'AND source.filePath IS NOT NULL'}
        ${projectFilterSource}
      RETURN DISTINCT
        source.name AS name,
        [label IN labels(source) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'incoming' AS direction,
        1 AS depth,
        source.filePath AS filePath
    `;

    const [directIncoming, functionUsesIncoming] = await Promise.all([
      client.query<NeighborRecord>(directIncomingCypher, { node_name, projectPath: project_path ?? '' }),
      client.query<NeighborRecord>(functionUsesIncomingCypher, { node_name, projectPath: project_path ?? '' }),
    ]);

    // Combine and dedupe
    const incomingMap = new Map<string, NeighborRecord>();
    [...directIncoming, ...functionUsesIncoming].forEach((r) => {
      if (!incomingMap.has(r.name)) {
        incomingMap.set(r.name, r);
      }
    });

    neighbors.push(
      ...Array.from(incomingMap.values()).map((r) => ({
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
