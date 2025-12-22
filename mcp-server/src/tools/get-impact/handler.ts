import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
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
  const { node_name, node_type, depth = 3, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const validation = await validateProject(client, project_path);
    if (!validation.valid) {
      return projectNotFoundResponse(validation.error);
    }
  }

  // Build project filter clause
  const projectFilter = project_path ? 'AND caller.filePath STARTS WITH $projectPath' : '';
  const projectFilterDependent = project_path ? 'AND dependent.filePath STARTS WITH $projectPath' : '';
  const projectFilterImpl = project_path ? 'AND impl.filePath STARTS WITH $projectPath' : '';
  const projectFilterChild = project_path ? 'AND child.filePath STARTS WITH $projectPath' : '';

  const impacts: ImpactResult[] = [];

  // Build label filter based on node_type
  const labelFilter = node_type ? node_type.charAt(0).toUpperCase() + node_type.slice(1) : null;

  // 1. Find callers (for functions)
  if (!node_type || node_type === 'function') {
    const callersCypher = `
      MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target:Function)
      WHERE target.name = $node_name
        AND caller <> target
        ${projectFilter}
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

    const callers = await client.query<ImpactRecord>(callersCypher, {
      node_name,
      projectPath: project_path ?? '',
    });
    impacts.push(...callers);
  }

  // 2. Find dependents (classes/interfaces whose functions use this node)
  if (!node_type || node_type === 'class' || node_type === 'interface') {
    const dependentsCypher = `
      MATCH (dependent)-[:DECLARES]->(f:Function)-[:USES]->(target)
      WHERE target.name = $node_name
        ${labelFilter ? `AND target:${labelFilter}` : 'AND (target:Class OR target:Interface)'}
        AND (dependent:Class OR dependent:Interface OR dependent:Object)
        AND dependent <> target
        ${projectFilterDependent}
      RETURN DISTINCT
        dependent.name AS name,
        [label IN labels(dependent) WHERE label IN ['Class', 'Interface', 'Object']][0] AS type,
        'dependent' AS impactType,
        1 AS depth,
        dependent.filePath AS filePath,
        coalesce(dependent.lineNumber, 0) AS lineNumber
      ORDER BY name
    `;

    const dependents = await client.query<ImpactRecord>(dependentsCypher, {
      node_name,
      projectPath: project_path ?? '',
    });
    impacts.push(...dependents);
  }

  // 3. Find implementors (classes implementing an interface)
  if (!node_type || node_type === 'interface') {
    const implementorsCypher = `
      MATCH (impl:Class)-[:IMPLEMENTS]->(target:Interface)
      WHERE target.name = $node_name
        ${projectFilterImpl}
      RETURN DISTINCT
        impl.name AS name,
        'class' AS type,
        'implementor' AS impactType,
        1 AS depth,
        impl.filePath AS filePath,
        coalesce(impl.lineNumber, 0) AS lineNumber
      ORDER BY name
    `;

    const implementors = await client.query<ImpactRecord>(implementorsCypher, {
      node_name,
      projectPath: project_path ?? '',
    });
    impacts.push(...implementors);
  }

  // 4. Find children (classes extending this class)
  if (!node_type || node_type === 'class') {
    const childrenCypher = `
      MATCH path = (child:Class)-[:EXTENDS*1..${depth}]->(target:Class)
      WHERE target.name = $node_name
        ${projectFilterChild}
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

    const children = await client.query<ImpactRecord>(childrenCypher, {
      node_name,
      projectPath: project_path ?? '',
    });
    impacts.push(...children);
  }

  const text = buildCompactOutput('IMPACT ANALYSIS', impacts, formatImpact);

  return {
    content: [{ type: 'text', text }],
  };
}
