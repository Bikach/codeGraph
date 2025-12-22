/**
 * Types for search_nodes tool
 */

export type SearchNodesParams = {
  query: string;
  node_types?: Array<'class' | 'interface' | 'function' | 'property' | 'object'>;
  exact_match?: boolean;
  limit?: number;
  project_path?: string;
};

export type NodeResult = {
  name: string;
  type: string;
  visibility: string;
  filePath: string;
  lineNumber: number;
};
