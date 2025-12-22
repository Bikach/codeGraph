import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
import type { GetImplementationsParams, ImplementationResult } from './types.js';

const formatImplementation = (i: ImplementationResult) =>
  `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

interface ImplementationRecord {
  name: string;
  filePath: string;
  lineNumber: number;
  isDirect: boolean;
}

export async function handleGetImplementations(
  client: Neo4jClient,
  params: GetImplementationsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { interface_name, include_indirect = false, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const validation = await validateProject(client, project_path);
    if (!validation.valid) {
      return projectNotFoundResponse(validation.error);
    }
  }

  // Build project filter clause
  const projectFilter = project_path ? 'AND c.filePath STARTS WITH $projectPath' : '';

  const implementations: ImplementationResult[] = [];

  // Query for direct implementations
  const directCypher = `
    MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface)
    WHERE i.name = $interface_name
      ${projectFilter}
    RETURN
      c.name AS name,
      c.filePath AS filePath,
      coalesce(c.lineNumber, 0) AS lineNumber,
      true AS isDirect
    ORDER BY c.name
  `;

  const direct = await client.query<ImplementationRecord>(directCypher, {
    interface_name,
    projectPath: project_path ?? '',
  });
  implementations.push(
    ...direct.map((r) => ({
      name: r.name,
      filePath: r.filePath,
      lineNumber: r.lineNumber,
      isDirect: true,
    }))
  );

  // Query for indirect implementations (classes that extend a class implementing the interface)
  if (include_indirect) {
    const indirectCypher = `
      MATCH (c:Class)-[:EXTENDS*1..]->(parent:Class)-[:IMPLEMENTS]->(i:Interface)
      WHERE i.name = $interface_name
        AND NOT (c)-[:IMPLEMENTS]->(i)
        ${projectFilter}
      RETURN DISTINCT
        c.name AS name,
        c.filePath AS filePath,
        coalesce(c.lineNumber, 0) AS lineNumber,
        false AS isDirect
      ORDER BY c.name
    `;

    const indirect = await client.query<ImplementationRecord>(indirectCypher, {
      interface_name,
      projectPath: project_path ?? '',
    });
    implementations.push(
      ...indirect.map((r) => ({
        name: r.name,
        filePath: r.filePath,
        lineNumber: r.lineNumber,
        isDirect: false,
      }))
    );
  }

  const text = buildCompactOutput('IMPLEMENTATIONS', implementations, formatImplementation);

  return {
    content: [{ type: 'text', text }],
  };
}
