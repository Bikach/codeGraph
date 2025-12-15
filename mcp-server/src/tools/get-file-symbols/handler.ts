import { Neo4jClient } from '../../neo4j/neo4j.js';
import { buildCompactOutput } from '../formatters.js';
import type { GetFileSymbolsParams, SymbolResult } from './types.js';

const formatSymbol = (s: SymbolResult) =>
  `${s.type} | ${s.name} | ${s.visibility} | ${s.lineNumber}`;

export async function handleGetFileSymbols(
  _client: Neo4jClient,
  params: GetFileSymbolsParams
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { file_path, include_private: _include_private = true } = params;

  // TODO: Implement Neo4j query
  // MATCH (n)
  // WHERE n.filePath = $file_path OR n.filePath ENDS WITH $file_path
  // AND ($include_private OR n.visibility IN ['public', 'protected'])
  // RETURN n.name, labels(n)[0] as type, n.visibility, n.lineNumber
  // ORDER BY n.lineNumber

  const symbols: SymbolResult[] = [];

  const text = buildCompactOutput(`SYMBOLS in ${file_path}`, symbols, formatSymbol);

  return {
    content: [{ type: 'text', text }],
  };
}
