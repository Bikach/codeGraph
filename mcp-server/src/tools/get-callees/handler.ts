import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
import type { GetCalleesParams, CalleeResult } from './types.js';

const formatCallee = (c: CalleeResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}`;

interface CalleeRecord {
  functionName: string;
  className: string | null;
  filePath: string;
  lineNumber: number;
  depth: number;
}

export async function handleGetCallees(
  client: Neo4jClient,
  params: GetCalleesParams
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
  const projectFilter = project_path ? 'AND source.filePath STARTS WITH $projectPath' : '';

  // Traverse forward from the source function to find callees
  const cypher = `
    MATCH path = (source:Function)-[:CALLS*1..${depth}]->(callee:Function)
    WHERE source.name = $function_name
      AND ($class_name IS NULL OR source.declaringType ENDS WITH $class_name)
      AND source <> callee
      ${projectFilter}
    WITH DISTINCT callee, length(path) AS pathDepth
    OPTIONAL MATCH (owner)-[:DECLARES]->(callee)
    WHERE owner:Class OR owner:Interface OR owner:Object
    RETURN
      callee.name AS functionName,
      owner.name AS className,
      callee.filePath AS filePath,
      coalesce(callee.lineNumber, 0) AS lineNumber,
      pathDepth AS depth
    ORDER BY pathDepth, className, functionName
  `;

  const records = await client.query<CalleeRecord>(cypher, {
    function_name,
    class_name: class_name ?? null,
    projectPath: project_path ?? '',
  });

  const callees: CalleeResult[] = records.map((r) => ({
    functionName: r.functionName,
    className: r.className ?? undefined,
    filePath: r.filePath,
    lineNumber: r.lineNumber,
    depth: r.depth,
  }));

  const text = buildCompactOutput('CALLEES', callees, formatCallee);

  return {
    content: [{ type: 'text', text }],
  };
}
