/**
 * Types for find_path tool
 */

export type FindPathParams = {
  from_node: string;
  to_node: string;
  max_depth?: number;
  relationship_types?: string[];
  project_path?: string;
};

export type PathStep = {
  step: number;
  type: string;
  name: string;
  relationship: string;
  filePath: string;
  lineNumber: number;
};
