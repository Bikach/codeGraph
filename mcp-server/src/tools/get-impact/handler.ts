import type { GraphStore } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetImpactParams, ImpactResult } from './types.js';

const formatImpact = (i: ImpactResult) =>
  `${i.impactType} | ${i.depth} | ${i.type} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

export async function handleGetImpact(
  store: GraphStore,
  params: GetImpactParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { node_name, node_type, depth = 3, scope = 'all', project_path } = params;

  // Validate project if project_path is provided
  if (project_path) {
    const project = await store.findProject(project_path);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(project_path));
    }
  }

  const impacts = await store.getImpact({
    nodeName: node_name,
    nodeType: node_type,
    depth,
    scope,
    projectPath: project_path,
  });

  const text = buildCompactOutput('IMPACT ANALYSIS', impacts, formatImpact);

  return {
    content: [{ type: 'text', text }],
  };
}
