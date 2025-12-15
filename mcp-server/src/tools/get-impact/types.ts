/**
 * Types for get_impact tool
 */

export type GetImpactParams = {
  node_name: string;
  node_type?: 'class' | 'interface' | 'function' | 'property';
  depth?: number;
};

export type ImpactResult = {
  name: string;
  type: string;
  impactType: 'caller' | 'dependent' | 'implementor' | 'child';
  depth: number;
  filePath: string;
  lineNumber: number;
};
