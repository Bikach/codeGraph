/**
 * Server configuration from environment variables
 */

import type { Config } from './config.types.js';

// Re-export types for backward compatibility
export type { ServerConfig, Config, EmbeddedConfig } from './config.types.js';

export const config: Config = {
  server: {
    name: 'codegraph-server',
    version: '0.1.0',
  },
  embedded: {
    // On-disk LadybugDB file. The indexer and the server must point at the same path.
    dbPath: process.env.EMBEDDED_DB_PATH || undefined,
  },
};
