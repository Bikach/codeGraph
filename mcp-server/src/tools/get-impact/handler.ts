import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetImpactParams, ImpactResult } from './types.js';

const formatImpact = (i: ImpactResult) =>
  `${i.impactType} | ${i.depth} | ${i.type} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

interface ImpactRecord {
  name: string;
  type: string;
  impactType: 'caller' | 'dependent' | 'implementor' | 'child';
  depth: number;
  filePath: string;
  lineNumber: number;
}

export async function handleGetImpact(
  client: Neo4jClient,
  params: GetImpactParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name, node_type, depth = 3 } = params;

  const impacts: ImpactResult[] = [];

  // Build label filter based on node_type
  const labelFilter = node_type ? node_type.charAt(0).toUpperCase() + node_type.slice(1) : null;

  // 1. Find callers (for functions)
  if (!node_type || node_type === 'function') {
    const callersCypher = `
      MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target:Function)
      WHERE target.name = $node_name
        AND caller <> target
      WITH DISTINCT caller, min(length(path)) AS pathDepth
      RETURN
        caller.name AS name,
        'function' AS type,
        'caller' AS impactType,
        pathDepth AS depth,
        caller.filePath AS filePath,
        coalesce(caller.lineNumber, 0) AS lineNumber
      ORDER BY pathDepth, name
    `;

    const callers = await client.query<ImpactRecord>(callersCypher, { node_name });
    impacts.push(...callers);
  }

  // 2. Find dependents (classes/interfaces that use this node)
  if (!node_type || node_type === 'class' || node_type === 'interface') {
    const dependentsCypher = `
      MATCH (dependent)-[:USES]->(target)
      WHERE target.name = $node_name
        ${labelFilter ? `AND target:${labelFilter}` : 'AND (target:Class OR target:Interface)'}
        AND (dependent:Class OR dependent:Interface OR dependent:Object)
      RETURN DISTINCT
        dependent.name AS name,
        [label IN labels(dependent) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'dependent' AS impactType,
        1 AS depth,
        dependent.filePath AS filePath,
        coalesce(dependent.lineNumber, 0) AS lineNumber
      ORDER BY name
    `;

    const dependents = await client.query<ImpactRecord>(dependentsCypher, { node_name });
    impacts.push(...dependents);
  }

  // 3. Find implementors (classes implementing an interface)
  if (!node_type || node_type === 'interface') {
    const implementorsCypher = `
      MATCH (impl:Class)-[:IMPLEMENTS]->(target:Interface)
      WHERE target.name = $node_name
      RETURN DISTINCT
        impl.name AS name,
        'class' AS type,
        'implementor' AS impactType,
        1 AS depth,
        impl.filePath AS filePath,
        coalesce(impl.lineNumber, 0) AS lineNumber
      ORDER BY name
    `;

    const implementors = await client.query<ImpactRecord>(implementorsCypher, { node_name });
    impacts.push(...implementors);
  }

  // 4. Find children (classes extending this class)
  if (!node_type || node_type === 'class') {
    const childrenCypher = `
      MATCH path = (child:Class)-[:EXTENDS*1..${depth}]->(target:Class)
      WHERE target.name = $node_name
      WITH DISTINCT child, min(length(path)) AS pathDepth
      RETURN
        child.name AS name,
        'class' AS type,
        'child' AS impactType,
        pathDepth AS depth,
        child.filePath AS filePath,
        coalesce(child.lineNumber, 0) AS lineNumber
      ORDER BY pathDepth, name
    `;

    const children = await client.query<ImpactRecord>(childrenCypher, { node_name });
    impacts.push(...children);
  }

  const text = buildCompactOutput('IMPACT ANALYSIS', impacts, formatImpact);

  return {
    content: [{ type: 'text', text }],
  };
}
