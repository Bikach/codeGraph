/**
 * Types for get_god_nodes tool
 */

export type GetGodNodesParams = {
  top_n?: number;
  scope?: 'main' | 'test' | 'all';
  sort_by?: 'in' | 'out' | 'degree';
  project_path?: string;
  exclude_accessors?: boolean;
};

export type GodNodeResult = {
  name: string;
  type: string;
  role: 'ripple' | 'fanout' | 'hub';
  degree: number;
  inDegree: number;
  outDegree: number;
  filePath: string;
  lineNumber: number;
};
