import { z } from 'zod';

export const getNeighborsDefinition = {
  name: 'get_neighbors',
  title: 'Get Neighbors',
  description: 'Get all neighboring nodes (dependencies and dependents) of a class/interface. Returns compact format: "direction | depth | Type | Name | filePath"',
  inputSchema: {
    node_name: z.string().describe('Name of the class/interface to get neighbors for'),
    direction: z.enum(['outgoing', 'incoming', 'both']).optional().default('both').describe('Direction: outgoing (dependencies), incoming (dependents), or both'),
    depth: z.number().int().min(1).max(5).optional().default(1).describe('Search depth (1 = direct only)'),
    include_external: z.boolean().optional().default(false).describe('Include external dependencies (npm packages)'),
  },
};
