import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetNeighborsParams, NeighborResult } from './types.js';

const formatNeighbor = (n: NeighborResult) =>
  `${n.direction} | ${n.depth} | ${n.type} | ${n.name}${n.filePath ? ` | ${n.filePath}` : ''}`;

export async function handleGetNeighbors(
  store: GraphStore,
  params: GetNeighborsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name, direction = 'both', depth = 1, include_external = false, scope = 'all', project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const neighbors = await store.getNeighbors({
    nodeName: node_name,
    direction,
    depth,
    includeExternal: include_external,
    scope,
    projectPath: project_path,
  });

  const text = buildCompactOutput('NEIGHBORS', neighbors, formatNeighbor);

  return {
    content: [{ type: 'text', text }],
  };
}
