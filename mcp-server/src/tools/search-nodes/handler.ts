import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { SearchNodesParams, NodeResult } from './types.js';

const formatNode = (n: NodeResult) =>
  `${n.type} | ${n.name} | ${n.visibility} | ${n.filePath}:${n.lineNumber}`;

interface SearchRecord {
  name: string;
  type: string;
  visibility: string;
  filePath: string;
  lineNumber: number;
}

export async function handleSearchNodes(
  client: Neo4jClient,
  params: SearchNodesParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { query, node_types, exact_match = false, limit = 20 } = params;

  // Build label filter - capitalize first letter for Neo4j labels
  const labels = node_types?.map((t) => t.charAt(0).toUpperCase() + t.slice(1)) ?? [
    'Class',
    'Interface',
    'Function',
    'Property',
    'Object',
  ];

  // Build the match condition based on exact_match
  // For regex search, escape special characters and use case-insensitive match
  const searchPattern = exact_match ? query : `(?i).*${escapeRegex(query)}.*`;

  const cypher = `
    MATCH (n)
    WHERE any(label IN labels(n) WHERE label IN $labels)
      AND n.name =~ $pattern
    RETURN
      n.name AS name,
      [label IN labels(n) WHERE label IN $labels][0] AS type,
      coalesce(n.visibility, 'public') AS visibility,
      n.filePath AS filePath,
      coalesce(n.lineNumber, 0) AS lineNumber
    ORDER BY n.name
    LIMIT toInteger($limit)
  `;

  const records = await client.query<SearchRecord>(cypher, {
    labels,
    pattern: searchPattern,
    limit: Math.trunc(limit), // Ensure integer for Neo4j LIMIT clause
  });

  const results: NodeResult[] = records.map((r) => ({
    name: r.name,
    type: r.type.toLowerCase(),
    visibility: r.visibility,
    filePath: r.filePath,
    lineNumber: r.lineNumber,
  }));

  const text = buildCompactOutput('NODES', results, formatNode);

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
