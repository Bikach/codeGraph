import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { emptyCallMessage } from '../call-hints.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetCallersParams, CallerResult } from './types.js';

const formatCaller = (c: CallerResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}${c.viaInterface ? ` | via ${c.viaInterface}` : ''}`;

export async function handleGetCallers(
  store: GraphStore,
  params: GetCallersParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name, class_name, depth = 2, scope = 'all', limit = 50, project_path, file_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const callers = await store.getCallers({
    functionName: function_name,
    className: class_name,
    depth,
    scope,
    projectPath: project_path,
    filePath: file_path,
  });

  const text =
    callers.length === 0
      ? await emptyCallMessage(store, 'CALLERS', function_name, class_name)
      : buildCompactOutput('CALLERS', callers.slice(0, limit), formatCaller, callers.length);

  return {
    content: [{ type: 'text', text }],
  };
}
