/**
 * Configuration type definitions
 */

export interface ServerConfig {
  name: string;
  version: string;
}

export interface EmbeddedConfig {
  /** On-disk LadybugDB file. Omit for in-memory (tests only — a server needs a persisted file). */
  dbPath?: string;
}

export interface Config {
  server: ServerConfig;
  embedded: EmbeddedConfig;
}
