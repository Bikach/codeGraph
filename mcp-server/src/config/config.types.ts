/**
 * Configuration type definitions
 */

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export interface ServerConfig {
  name: string;
  version: string;
}

export interface Config {
  neo4j: Neo4jConfig;
  server: ServerConfig;
  /** When true, disables get_callers and get_implementations tools (LSP handles these) */
  lspMode: boolean;
}
