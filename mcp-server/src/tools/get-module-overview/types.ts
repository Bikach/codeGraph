/**
 * Types for get_module_overview tool
 */

export type GetModuleOverviewParams = {
  top_n?: number;
  scope?: 'main' | 'all';
  project_path?: string;
  communities?: boolean;
  exclude_accessors?: boolean;
};
