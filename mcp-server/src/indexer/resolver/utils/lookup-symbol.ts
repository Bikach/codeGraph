/**
 * Lookup a symbol by FQN in the symbol table.
 */

import type { Symbol, SymbolTable } from '../types.js';

/**
 * Lookup a symbol by FQN.
 */
export function lookupSymbol(table: SymbolTable, fqn: string): Symbol | undefined {
  return table.byFqn.get(fqn);
}
