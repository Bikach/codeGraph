import { z } from 'zod';

export const findPathDefinition = {
  name: 'find_path',
  title: 'Find Path',
  description: 'Find the shortest path between two nodes in the code graph. Directed by default (follows edge direction = "does from reach to", i.e. call/dependency flow); set directed=false for mere connectivity (a path that may traverse edges backwards). Returns compact format: "step | Type | Name | relationship | filePath:line"',
  inputSchema: {
    from_node: z.string().describe('Name of the starting node'),
    to_node: z.string().describe('Name of the target node'),
    max_depth: z.number().int().min(1).max(10).optional().default(5).describe('Maximum path length to search'),
    relationship_types: z.array(z.string()).optional().describe('Filter by relationship types (e.g., ["CALLS", "USES"])'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
    directed: z.boolean().optional().default(true).describe('Follow edge direction (default true = A reaches B via call/dependency flow). false = undirected connectivity ("are these two linked at all").'),
  },
};

export type { FindPathParams } from './types.js';
