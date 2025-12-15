import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetImplementationsParams, ImplementationResult } from './types.js';

const formatImplementation = (i: ImplementationResult) =>
  `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`;

export async function handleGetImplementations(
  _client: Neo4jClient,
  params: GetImplementationsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { interface_name: _interface_name, include_indirect: _include_indirect = false } = params;

  // TODO: Implement Neo4j query
  // Direct: MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface {name: $interface_name})
  // Indirect: MATCH (c:Class)-[:EXTENDS*]->(parent:Class)-[:IMPLEMENTS]->(i:Interface {name: $interface_name})

  const implementations: ImplementationResult[] = [];

  const text = buildCompactOutput('IMPLEMENTATIONS', implementations, formatImplementation);

  return {
    content: [{ type: 'text', text }],
  };
}
