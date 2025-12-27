/**
 * Try to resolve a simple type name to its FQN.
 */

import type { SymbolTable } from '../types.js';

/**
 * Try to resolve a simple type name to its FQN.
 *
 * Resolution strategy:
 * 1. Check if it's already an FQN (exists in symbol table)
 * 2. Check same package
 * 3. Check by simple name (if unique)
 *
 * @param table - The symbol table to search in
 * @param typeName - The type name to resolve (may include generics)
 * @param currentPackage - The current package context
 * @returns The resolved FQN, or undefined if not found
 */
export function resolveTypeName(
  table: SymbolTable,
  typeName: string,
  currentPackage: string
): string | undefined {
  // Remove generics for lookup
  const baseName = typeName.split('<')[0]?.trim() ?? typeName;

  // 1. Check if it's already an FQN
  if (table.byFqn.has(baseName)) {
    return baseName;
  }

  // 2. Check same package
  const samePackageFqn = currentPackage ? `${currentPackage}.${baseName}` : baseName;
  if (table.byFqn.has(samePackageFqn)) {
    return samePackageFqn;
  }

  // 3. Check by simple name (might find it in another package)
  const candidates = table.byName.get(baseName);
  if (candidates && candidates.length === 1 && candidates[0]) {
    return candidates[0].fqn;
  }

  return undefined;
}
