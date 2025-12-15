import { z } from 'zod';

export const getFileSymbolsDefinition = {
  name: 'get_file_symbols',
  title: 'Get File Symbols',
  description: 'List all symbols (classes, interfaces, functions, properties) defined in a file. Returns compact format: "type | Name | visibility | line"',
  inputSchema: {
    file_path: z.string().describe('Path to the file (absolute or relative to project root)'),
    include_private: z.boolean().optional().default(true).describe('Include private/internal symbols'),
  },
};

export type GetFileSymbolsParams = {
  file_path: string;
  include_private?: boolean;
};
