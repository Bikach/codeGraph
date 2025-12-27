/**
 * Find all methods with a given name in a type.
 */

import type { FunctionSymbol, SymbolTable } from '../types.js';

/**
 * Find all methods with a given name in a type.
 * This handles overloaded methods that share the same base FQN.
 */
export function findMethodsInType(table: SymbolTable, typeFqn: string, methodName: string): FunctionSymbol[] {
  const candidates: FunctionSymbol[] = [];

  // Get all functions with this name
  const allFunctions = table.functionsByName.get(methodName) || [];

  for (const func of allFunctions) {
    // Check if this function belongs to the type
    if (func.declaringTypeFqn === typeFqn) {
      candidates.push(func);
    }
  }

  // Also check for exact FQN match (single method case)
  const exactFqn = `${typeFqn}.${methodName}`;
  const exactMatch = table.byFqn.get(exactFqn);
  if (exactMatch?.kind === 'function' && !candidates.some((c) => c.fqn === exactMatch.fqn)) {
    candidates.push(exactMatch as FunctionSymbol);
  }

  return candidates;
}
