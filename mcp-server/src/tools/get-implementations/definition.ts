import { z } from 'zod';

export const getImplementationsDefinition = {
  name: 'get_implementations',
  title: 'Get Implementations',
  description: 'Find all classes that implement a given interface or extend an abstract class. Returns compact format: "direct/indirect | ClassName | filePath:line"',
  inputSchema: {
    interface_name: z.string().describe('Name of the interface or abstract class'),
    include_indirect: z.boolean().optional().default(false).describe('Include indirect implementations (via inheritance chain)'),
    project_path: z.string().optional().describe('Filter by project path (use current working directory). If not provided, searches all indexed projects.'),
  },
};
