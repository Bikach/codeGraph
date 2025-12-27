/**
 * Add a symbol to all relevant indexes in the symbol table.
 */

import type { Symbol, SymbolTable } from '../types.js';

/**
 * Add a symbol to all relevant indexes in the symbol table.
 */
export function addSymbol(table: SymbolTable, symbol: Symbol): void {
  // Index by FQN
  table.byFqn.set(symbol.fqn, symbol);

  // Index by simple name
  const byName = table.byName.get(symbol.name) || [];
  byName.push(symbol);
  table.byName.set(symbol.name, byName);

  // Index by package
  if (symbol.packageName) {
    const byPackage = table.byPackage.get(symbol.packageName) || [];
    byPackage.push(symbol);
    table.byPackage.set(symbol.packageName, byPackage);
  }
}
