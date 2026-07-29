import type { GraphStore } from '../../engine/store/graph-store.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { FindPathParams, PathStep } from './types.js';

const formatPathStep = (p: PathStep) =>
  `${p.step} | ${p.type} | ${p.name} | ${p.relationship} | ${p.filePath}:${p.lineNumber}`;

export async function handleFindPath(
  store: GraphStore,
  params: FindPathParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { from_node, to_node, max_depth = 5, relationship_types, project_path, directed = true } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const steps = await store.findPath({
    fromNode: from_node,
    toNode: to_node,
    maxDepth: max_depth,
    relationshipTypes: relationship_types,
    projectPath: project_path,
    directed,
  });

  if (!steps) {
    return {
      content: [
        {
          type: 'text',
          text: `PATH: No path found from "${from_node}" to "${to_node}" within depth ${max_depth}`,
        },
      ],
    };
  }

  const text = `PATH (${steps.length} nodes):\n${steps.map(formatPathStep).join('\n')}`;

  return {
    content: [{ type: 'text', text }],
  };
}
