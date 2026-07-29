import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { SearchNodesParams, NodeResult } from './types.js';

const formatNode = (n: NodeResult) =>
  `${n.type} | ${n.name} | ${n.visibility} | ${n.filePath}:${n.lineNumber}`;

export async function handleSearchNodes(
  store: GraphStore,
  params: SearchNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { query, node_types, exact_match = false, limit = 20, project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const nodes = await store.searchNodes({
    query,
    match: exact_match ? 'exact' : 'contains',
    nodeTypes: node_types,
    limit,
    projectPath: project_path,
  });

  const text = buildCompactOutput('NODES', nodes, formatNode);

  return {
    content: [{ type: 'text', text }],
  };
}
