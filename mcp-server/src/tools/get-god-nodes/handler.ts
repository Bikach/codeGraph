import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetGodNodesParams, GodNodeResult } from './types.js';

const formatGodNode = (n: GodNodeResult) =>
  `${n.degree} | ${n.inDegree}/${n.outDegree} | ${n.role} | ${n.type} | ${n.name} | ${n.filePath}:${n.lineNumber}`;

export async function handleGetGodNodes(
  store: GraphStore,
  params: GetGodNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { top_n = 20, scope = 'main', sort_by = 'in', project_path, exclude_accessors = false } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const godNodes = await store.getGodNodes({
    topN: top_n,
    scope,
    sortBy: sort_by,
    projectPath: project_path,
    excludeAccessors: exclude_accessors,
  });

  const text = buildCompactOutput('GOD_NODES', godNodes, formatGodNode);

  return {
    content: [{ type: 'text', text }],
  };
}
