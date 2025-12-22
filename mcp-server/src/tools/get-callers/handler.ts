import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
import type { GetCallersParams, CallerResult } from './types.js';

const formatCaller = (c: CallerResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}`;

interface CallerRecord {
  functionName: string;
  className: string | null;
  filePath: string;
  lineNumber: number;
  depth: number;
}

export async function handleGetCallers(
  client: Neo4jClient,
  params: GetCallersParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name, class_name, depth = 2, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const validation = await validateProject(client, project_path);
    if (!validation.valid) {
      return projectNotFoundResponse(validation.error);
    }
  }

  // Build project filter clause
  const projectFilter = project_path ? 'AND caller.filePath STARTS WITH $projectPath' : '';

  // Use APOC-free approach with variable-length path
  // We find the target function first, then traverse backwards to find callers
  const cypher = `
    MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target:Function)
    WHERE target.name = $function_name
      AND ($class_name IS NULL OR target.declaringType ENDS WITH $class_name)
      AND caller <> target
      ${projectFilter}
    WITH DISTINCT caller, length(path) AS pathDepth
    OPTIONAL MATCH (owner)-[:DECLARES]->(caller)
    WHERE owner:Class OR owner:Interface OR owner:Object
    RETURN
      caller.name AS functionName,
      owner.name AS className,
      caller.filePath AS filePath,
      coalesce(caller.lineNumber, 0) AS lineNumber,
      pathDepth AS depth
    ORDER BY pathDepth, className, functionName
  `;

  const records = await client.query<CallerRecord>(cypher, {
    function_name,
    class_name: class_name ?? null,
    projectPath: project_path ?? '',
  });

  const callers: CallerResult[] = records.map((r) => ({
    functionName: r.functionName,
    className: r.className ?? undefined,
    filePath: r.filePath,
    lineNumber: r.lineNumber,
    depth: r.depth,
  }));

  const text = buildCompactOutput('CALLERS', callers, formatCaller);

  return {
    content: [{ type: 'text', text }],
  };
}
