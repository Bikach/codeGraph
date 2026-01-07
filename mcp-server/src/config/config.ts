/**
 * Server configuration from environment variables
 */

import type { Config } from './config.types.js';

// Re-export types for backward compatibility
export type { Neo4jConfig, ServerConfig, Config } from './config.types.js';

export const config: Config = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },
  server: {
    name: 'codegraph-server',
    version: '0.1.0',
  },
};
