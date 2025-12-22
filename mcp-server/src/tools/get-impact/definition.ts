import { z } from 'zod';

export const getImpactDefinition = {
  name: 'get_impact',
  title: 'Get Impact',
  description: 'Analyze the impact of modifying a node. Shows all nodes that would be affected by changes. Returns compact format: "impact_type | depth | Type | Name | filePath:line"',
  inputSchema: {
    node_name: z.string().describe('Name of the node to analyze impact for'),
    node_type: z.enum(['class', 'interface', 'function', 'property']).optional().describe('Type of node (for disambiguation)'),
    depth: z.number().int().min(1).max(10).optional().default(3).describe('Analysis depth'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
  },
};

export type { GetImpactParams, ImpactResult } from './types.js';
