import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { emptyCallMessage } from '../call-hints.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetCalleesParams, CalleeResult } from './types.js';

const formatCallee = (c: CalleeResult) =>
  `${c.depth} | ${c.className ? `${c.className}.` : ''}${c.functionName}() | ${c.filePath}:${c.lineNumber}`;

export async function handleGetCallees(
  store: GraphStore,
  params: GetCalleesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { function_name, class_name, depth = 2, scope = 'all', limit = 50, project_path, file_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const callees = await store.getCallees({
    functionName: function_name,
    className: class_name,
    depth,
    scope,
    projectPath: project_path,
    filePath: file_path,
  });

  const text =
    callees.length === 0
      ? await emptyCallMessage(store, 'CALLEES', function_name, class_name)
      : buildCompactOutput('CALLEES', callees.slice(0, limit), formatCallee, callees.length);

  return {
    content: [{ type: 'text', text }],
  };
}
