/**
 * Server configuration from environment variables
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
}

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
