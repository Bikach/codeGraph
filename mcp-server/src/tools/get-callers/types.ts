/**
 * Types for get_callers tool
 */

export type GetCallersParams = {
  function_name: string;
  class_name?: string;
  depth?: number;
  project_path?: string;
};

export type CallerResult = {
  functionName: string;
  className?: string;
  filePath: string;
  lineNumber: number;
  depth: number;
};
