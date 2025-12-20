#!/usr/bin/env npx tsx
/**
 * Check Neo4j status and graph statistics.
 * Returns JSON for Claude Code to interpret.
 */

import { Neo4jClient } from '../neo4j/neo4j.js';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

interface StatusResult {
  connected: boolean;
  neo4jUri: string;
  browserUrl: string;
  nodes: Record<string, number>;
  relationships: Record<string, number>;
  totalNodes: number;
  totalRelationships: number;
  error?: string;
}

async function getStats(client: Neo4jClient): Promise<{ nodes: Record<string, number>; relationships: Record<string, number> }> {
  const nodes: Record<string, number> = {};
  const relationships: Record<string, number> = {};

  const nodeLabels = ['Package', 'Class', 'Interface', 'Object', 'Function', 'Property', 'Parameter', 'Annotation'];
  for (const label of nodeLabels) {
    const result = await client.query<{ count: number }>(`MATCH (n:${label}) RETURN count(n) as count`);
    const count = result[0]?.count ?? 0;
    if (count > 0) nodes[label] = count;
  }

  const relTypes = ['CONTAINS', 'DECLARES', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'USES', 'HAS_PARAMETER', 'ANNOTATED_WITH', 'RETURNS'];
  for (const type of relTypes) {
    const result = await client.query<{ count: number }>(`MATCH ()-[r:${type}]->() RETURN count(r) as count`);
    const count = result[0]?.count ?? 0;
    if (count > 0) relationships[type] = count;
  }

  return { nodes, relationships };
}

async function main(): Promise<void> {
  const result: StatusResult = {
    connected: false,
    neo4jUri: NEO4J_URI,
    browserUrl: 'http://localhost:7474',
    nodes: {},
    relationships: {},
    totalNodes: 0,
    totalRelationships: 0,
  };

  const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await client.connect();
    result.connected = true;

    const stats = await getStats(client);
    result.nodes = stats.nodes;
    result.relationships = stats.relationships;
    result.totalNodes = Object.values(stats.nodes).reduce((a, b) => a + b, 0);
    result.totalRelationships = Object.values(stats.relationships).reduce((a, b) => a + b, 0);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    await client.close();
  }

  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.log(JSON.stringify({ connected: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
