/**
 * Types for get_implementations tool
 */

export type GetImplementationsParams = {
  interface_name: string;
  include_indirect?: boolean;
};

export type ImplementationResult = {
  name: string;
  filePath: string;
  lineNumber: number;
  isDirect: boolean;
};
