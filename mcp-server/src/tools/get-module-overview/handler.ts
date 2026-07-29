import type { GraphStore, DomainRef, DomainDependencyRef, DomainCycleRef, GodNodeRef, CommunityRef } from '../../engine/store/graph-store.js';
import { buildCompactOutput } from '../formatters.js';
import { projectNotFoundResponse, projectNotFoundError } from '../project-filter.js';
import type { GetModuleOverviewParams } from './types.js';

const formatDomain = (d: DomainRef) =>
  `${d.name} | ${d.fileCount} files | ${d.packages.join(' ') || '-'}`;

const formatDependency = (dep: DomainDependencyRef) => `${dep.from} -> ${dep.to} | ${dep.weight}`;

const formatCycle = (c: DomainCycleRef) => `${c.a} <-> ${c.b} | ${c.weightAtoB}/${c.weightBtoA}`;

const formatHotspot = (n: GodNodeRef) =>
  `${n.degree} | ${n.inDegree}/${n.outDegree} | ${n.role} | ${n.type} | ${n.name} | ${n.filePath}:${n.lineNumber}`;

const formatCommunity = (c: CommunityRef) =>
  `${c.name} | ${c.size} types | ${c.packageCount} pkgs | ${c.packages.join(' ') || '-'}`;

export async function handleGetModuleOverview(
  store: GraphStore,
  params: GetModuleOverviewParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { top_n = 10, scope = 'main', project_path, communities = false, exclude_accessors = false } = params;
  let scopePath = project_path;

  if (scopePath) {
    // Validate the explicitly requested project.
    const project = await store.findProject(scopePath);
    if (!project) {
      return projectNotFoundResponse(projectNotFoundError(scopePath));
    }
  } else {
    // No scope given: a merged multi-project map is both meaningless (mixes unrelated codebases) AND
    // too large to return (token overflow). With several projects, list them and require scoping; with
    // exactly one, scope to it implicitly so the common single-repo case "just works".
    const projects = await store.listProjects();
    if (projects.length > 1) {
      const text =
        `${projects.length} projects are indexed. A merged map is too large to return — ` +
        `pass project_path to scope to one:\n` +
        projects.map((p) => `${p.name} | ${p.path}`).join('\n');
      return { content: [{ type: 'text', text }] };
    }
    scopePath = projects[0]?.path;
  }

  const overview = await store.getModuleOverview({
    topN: top_n,
    scope,
    projectPath: scopePath,
    includeCommunities: communities,
    excludeAccessors: exclude_accessors,
  });

  // Lead with MODULES (packages — correct on well-structured code). COMMUNITIES only when opted in.
  const sections = [buildCompactOutput('MODULES', overview.domains, formatDomain)];
  if (communities) sections.push(buildCompactOutput('COMMUNITIES', overview.communities, formatCommunity));
  sections.push(
    buildCompactOutput('CYCLES', overview.cycles, formatCycle),
    buildCompactOutput('DOMAIN_DEPS', overview.dependencies, formatDependency),
    buildCompactOutput('HOTSPOTS', overview.hotspots, formatHotspot)
  );
  const text = sections.join('\n\n');

  return {
    content: [{ type: 'text', text }],
  };
}
