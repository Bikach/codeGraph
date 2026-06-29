import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetImplementationsParams, ImplementationResult } from './types.js';

const formatImplementation = (i: ImplementationResult) =>
  `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

export async function handleGetImplementations(
  store: GraphStore,
  params: GetImplementationsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { interface_name, include_indirect = false, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const implementations = await store.getImplementations({
    interfaceName: interface_name,
    includeIndirect: include_indirect,
    projectPath: project_path,
  });

  const text = buildCompactOutput('IMPLEMENTATIONS', implementations, formatImplementation);

  return {
    content: [{ type: 'text', text }],
  };
}
