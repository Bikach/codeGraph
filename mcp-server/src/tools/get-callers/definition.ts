import { z } from 'zod';

export const getCallersDefinition = {
  name: 'get_callers',
  title: 'Get Callers',
  description: 'Find all functions that call the specified function. In-project only: calls into external libraries (Spring, MyBatis, AWS SDK…) are not indexed, so they never appear. Returns compact format: "depth | Class.function() | filePath:line"',
  inputSchema: {
    function_name: z.string().describe('Name of the function to find callers for'),
    class_name: z.string().optional().describe('Class containing the function (for disambiguation)'),
    depth: z.number().int().min(1).max(5).optional().default(2).describe('Trace depth (1 = direct callers only)'),
    scope: z.enum(['main', 'all']).optional().default('all').describe('Scope: all (default, includes test callers) or main (prod only — excludes callers in test files)'),
    limit: z.number().int().min(1).max(500).optional().default(50).describe('Max callers listed (default 50). Output notes the total when truncated; use get_impact for the full aggregate.'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
    file_path: z.string().optional().describe('Disambiguate a homonymous free function (e.g. a `buildVm` defined in many files): keep only the definition whose file path contains this string. Copy it from search_nodes output. Not needed for class methods (use class_name).'),
  },
};
