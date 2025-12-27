/**
 * Find all symbols matching a pattern (simple glob-like matching).
 */

import type { Symbol, SymbolTable } from '../types.js';

/**
 * Find all symbols matching a pattern (simple glob-like matching).
 * Supports * as wildcard for any characters.
 */
export function findSymbols(table: SymbolTable, pattern: string): Symbol[] {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  const results: Symbol[] = [];

  for (const symbol of table.byFqn.values()) {
    if (regex.test(symbol.fqn) || regex.test(symbol.name)) {
      results.push(symbol);
    }
  }

  return results;
}
