import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetFileSymbolsParams, SymbolResult } from './types.js';

const formatSymbol = (s: SymbolResult) =>
  `${s.type} | ${s.name} | ${s.visibility} | ${s.lineNumber}`;

export async function handleGetFileSymbols(
  store: GraphStore,
  params: GetFileSymbolsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { file_path, include_private = true, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const symbols = await store.getFileSymbols({
    filePath: file_path,
    includePrivate: include_private,
    projectPath: project_path,
  });

  const text = buildCompactOutput(`SYMBOLS in ${file_path}`, symbols, formatSymbol);

  return {
    content: [{ type: 'text', text }],
  };
}
