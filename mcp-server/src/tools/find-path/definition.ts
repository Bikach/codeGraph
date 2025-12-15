import { z } from 'zod';

export const findPathDefinition = {
  name: 'find_path',
  title: 'Find Path',
  description: 'Find the shortest path between two nodes in the code graph. Returns compact format showing the path: "step | Type | Name | relationship | filePath:line"',
  inputSchema: {
    from_node: z.string().describe('Name of the starting node'),
    to_node: z.string().describe('Name of the target node'),
    max_depth: z.number().min(1).max(10).optional().default(5).describe('Maximum path length to search'),
    relationship_types: z.array(z.string()).optional().describe('Filter by relationship types (e.g., ["CALLS", "USES"])'),
  },
};

export type { FindPathParams } from './types.js';
