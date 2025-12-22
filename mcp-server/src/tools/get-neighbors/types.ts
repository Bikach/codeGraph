/**
 * Types for get_neighbors tool
 */

export type GetNeighborsParams = {
  node_name: string;
  direction?: 'outgoing' | 'incoming' | 'both';
  depth?: number;
  include_external?: boolean;
  project_path?: string;
};

export type NeighborResult = {
  name: string;
  type: string;
  direction: 'outgoing' | 'incoming';
  depth: number;
  filePath?: string;
};
