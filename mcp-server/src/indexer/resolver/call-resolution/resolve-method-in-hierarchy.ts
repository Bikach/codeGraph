/**
 * Resolve a method by traversing the type hierarchy.
 * Supports overload resolution when call info is available.
 */

import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { findMethodsInType, selectBestOverload } from '../overload-resolution/index.js';

/**
 * Resolve a method by traversing the type hierarchy.
 * Supports overload resolution when call info is available.
 *
 * @param table - The symbol table to search in
 * @param _context - The resolution context (unused but kept for consistency)
 * @param typeFqn - The FQN of the type to start searching from
 * @param methodName - The name of the method to find
 * @param call - Optional call info for overload resolution
 * @returns The resolved method FQN, or undefined if not found
 */
export function resolveMethodInHierarchy(
  table: SymbolTable,
  _context: ResolutionContext,
  typeFqn: string,
  methodName: string,
  call?: ParsedCall
): string | undefined {
  const parents = table.typeHierarchy.get(typeFqn);
  if (!parents) return undefined;

  for (const parentFqn of parents) {
    // Find all methods with this name in the parent type
    const candidates = findMethodsInType(table, parentFqn, methodName);

    if (candidates.length === 1 && candidates[0]) {
      return candidates[0].fqn;
    } else if (candidates.length > 1) {
      // Multiple overloads - use overload resolution
      const best = selectBestOverload(candidates, call);
      if (best) return best.fqn;
    }

    // Also check exact FQN match for backward compatibility
    if (candidates.length === 0) {
      const parentMethodFqn = `${parentFqn}.${methodName}`;
      if (table.byFqn.has(parentMethodFqn)) {
        return parentMethodFqn;
      }
    }

    // Recursively check parent's parents
    const inherited = resolveMethodInHierarchy(table, _context, parentFqn, methodName, call);
    if (inherited) return inherited;
  }

  return undefined;
}
