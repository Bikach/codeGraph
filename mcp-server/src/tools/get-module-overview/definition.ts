import { z } from 'zod';

export const getModuleOverviewDefinition = {
  name: 'get_module_overview',
  title: 'Get Module Overview',
  description:
    'High-level map of a project: its named modules/domains (inferred from packages or, for TS/JS, from module paths), the weighted dependencies between them, and the hotspots (most depended-upon nodes). Answers macro questions like "how is this project organized?" or "where does X live?". Domains are computed at indexing time. Lead with MODULES — on well-structured codebases the packages already ARE the right grouping. Returns compact sections: MODULES (name | N files | packages), CYCLES (mutual-coupling pairs A <-> B | wAB/wBA — a DDD smell), DOMAIN_DEPS (from -> to | weight), HOTSPOTS (degree | in/out | role | type | Name | path:line). With communities=true, also COMMUNITIES (topological clusters).',
  inputSchema: {
    top_n: z.number().int().min(1).max(50).optional().default(10).describe('Number of hotspots to include'),
    scope: z.enum(['main', 'all']).optional().default('main').describe('Scope: main (prod only — excludes test files from file counts, dependencies and hotspots — default) or all'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, covers all indexed projects.'),
    communities: z.boolean().optional().default(false).describe('Also compute topological communities (seeded Louvain) — emergent modules grouped by coupling, named by their hub type. OFF by default: on well-organized projects the package-based MODULES are already correct and communities mostly add noise; turn ON when the packaging is flat/messy and hides the real structure.'),
    exclude_accessors: z.boolean().optional().default(false).describe('De-noise HOTSPOTS by dropping trivial accessors (getName/setX/isY backed by a real property). Useful on getter-heavy domain models (JPA entities, DTOs).'),
  },
};
