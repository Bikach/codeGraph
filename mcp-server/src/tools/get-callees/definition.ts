import { z } from 'zod';

export const getCalleesDefinition = {
  name: 'get_callees',
  title: 'Get Callees',
  description: 'Find all functions called by the specified function. Returns compact format: "depth | Class.function() | filePath:line"',
  inputSchema: {
    function_name: z.string().describe('Name of the function to find callees for'),
    class_name: z.string().optional().describe('Class containing the function (for disambiguation)'),
    depth: z.number().min(1).max(5).optional().default(2).describe('Trace depth (1 = direct callees only)'),
  },
};
