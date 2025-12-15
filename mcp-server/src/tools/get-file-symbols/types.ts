/**
 * Types for get_file_symbols tool
 */

export type GetFileSymbolsParams = {
  file_path: string;
  include_private?: boolean;
};

export type SymbolResult = {
  name: string;
  type: string;
  visibility: string;
  lineNumber: number;
};
