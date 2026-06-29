/**
 * Types for get_callers tool
 */

export type GetCallersParams = {
  function_name: string;
  class_name?: string;
  depth?: number;
  scope?: 'main' | 'all';
  limit?: number;
  project_path?: string;
  file_path?: string;
};

export type CallerResult = {
  functionName: string;
  className?: string;
  filePath: string;
  lineNumber: number;
  depth: number;
  viaInterface?: string;
};
