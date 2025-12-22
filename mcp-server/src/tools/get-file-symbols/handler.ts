import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import { validateProject, projectNotFoundResponse } from '../project-filter.js';
import type { GetFileSymbolsParams, SymbolResult } from './types.js';

const formatSymbol = (s: SymbolResult) =>
  `${s.type} | ${s.name} | ${s.visibility} | ${s.lineNumber}`;

interface SymbolRecord {
  name: string;
  type: string;
  visibility: string;
  lineNumber: number;
}

export async function handleGetFileSymbols(
  client: Neo4jClient,
  params: GetFileSymbolsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { file_path, include_private = true, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const validation = await validateProject(client, project_path);
    if (!validation.valid) {
      return projectNotFoundResponse(validation.error);
    }
  }

  // Build project filter clause
  const projectFilter = project_path ? 'AND n.filePath STARTS WITH $projectPath' : '';

  // Query for all symbols in a file
  // Support both exact path and partial path (ends with)
  const cypher = `
    MATCH (n)
    WHERE (n.filePath = $file_path OR n.filePath ENDS WITH $file_path)
      AND any(label IN labels(n) WHERE label IN ['Class', 'Interface', 'Function', 'Property', 'Object'])
      ${include_private ? '' : "AND coalesce(n.visibility, 'public') IN ['public', 'protected', 'internal']"}
      ${projectFilter}
    RETURN
      n.name AS name,
      [label IN labels(n) WHERE label IN ['Class', 'Interface', 'Function', 'Property', 'Object']][0] AS type,
      coalesce(n.visibility, 'public') AS visibility,
      coalesce(n.lineNumber, 0) AS lineNumber
    ORDER BY lineNumber, type, name
  `;

  const records = await client.query<SymbolRecord>(cypher, {
    file_path,
    projectPath: project_path ?? '',
  });

  const symbols: SymbolResult[] = records.map((r) => ({
    name: r.name,
    type: r.type.toLowerCase(),
    visibility: r.visibility,
    lineNumber: r.lineNumber,
  }));

  const text = buildCompactOutput(`SYMBOLS in ${file_path}`, symbols, formatSymbol);

  return {
    content: [{ type: 'text', text }],
  };
}
