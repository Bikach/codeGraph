import { z } from 'zod';

export const getGodNodesDefinition = {
  name: 'get_god_nodes',
  title: 'Get God Nodes',
  description:
    'Find the project hotspots: the most connected nodes by semantic degree (incoming + outgoing CALLS/USES/EXTENDS/IMPLEMENTS). Incoming = where a change ripples widest (ports, providers, value objects); outgoing = local fan-out/complexity. Degree counts RAW edges (a class using a type in 3 methods counts 3), not distinct dependents — use get_impact for the precise blast radius. Returns compact format: "degree | in/out | role | type | Name | filePath:line" (role: ripple/fanout/hub).',
  inputSchema: {
    top_n: z.number().int().min(1).max(100).optional().default(20).describe('Number of top hotspots to return'),
    scope: z.enum(['main', 'test', 'all']).optional().default('main').describe('Scope: main (prod only, excludes test nodes — default), test (tests only), or all'),
    sort_by: z.enum(['in', 'out', 'degree']).optional().default('in').describe('Rank by: in (incoming = ripple/blast radius — default), out (outgoing = fan-out/complexity), or degree (total)'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
    exclude_accessors: z.boolean().optional().default(false).describe('Drop trivial accessors (getName/setX/isY backed by a real property of the class) from the ranking, to de-noise hotspots on getter-heavy code. Keeps real methods like getUserByLogin.'),
  },
};
