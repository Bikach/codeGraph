import { z } from 'zod';

export const getCallersDefinition = {
  name: 'get_callers',
  title: 'Get Callers',
  description: 'Find all functions that call the specified function. Returns compact format: "depth | Class.function() | filePath:line"',
  inputSchema: {
    function_name: z.string().describe('Name of the function to find callers for'),
    class_name: z.string().optional().describe('Class containing the function (for disambiguation)'),
    depth: z.number().int().min(1).max(5).optional().default(2).describe('Trace depth (1 = direct callers only)'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
  },
};
