/**
 * Find all functions with a given name in a package.
 */

import type { FunctionSymbol, SymbolTable } from '../types.js';

/**
 * Find all functions with a given name in a package.
 */
export function findFunctionsInPackage(table: SymbolTable, packageName: string, functionName: string): FunctionSymbol[] {
  const candidates: FunctionSymbol[] = [];
  const allFunctions = table.functionsByName.get(functionName) || [];

  for (const func of allFunctions) {
    if (func.packageName === packageName && !func.declaringTypeFqn) {
      // Top-level function in this package
      candidates.push(func);
    }
  }

  return candidates;
}
