import { z } from 'zod';

export const searchNodesDefinition = {
  name: 'search_nodes',
  title: 'Search Nodes',
  description: 'Search for nodes (classes, interfaces, functions, properties) by name or pattern in the code graph. Returns compact format: "type | Name | visibility | filePath:line"',
  inputSchema: {
    query: z.string().describe('Search query (name or pattern)'),
    node_types: z.array(z.enum(['class', 'interface', 'function', 'property', 'object'])).optional().describe('Filter by node types (all if not specified)'),
    exact_match: z.boolean().optional().default(false).describe('If true, exact match. If false, partial match (CONTAINS)'),
    limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum number of results'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
  },
};
