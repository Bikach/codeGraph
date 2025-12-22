/**
 * Types for get_callees tool
 */

export type GetCalleesParams = {
  function_name: string;
  class_name?: string;
  depth?: number;
  project_path?: string;
};

export type CalleeResult = {
  functionName: string;
  className?: string;
  filePath: string;
  lineNumber: number;
  depth: number;
};
