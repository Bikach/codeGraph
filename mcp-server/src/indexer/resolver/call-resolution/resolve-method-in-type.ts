/**
 * Resolve a method call on a specific type.
 * Handles type aliases by resolving to the underlying type.
 * Supports overload resolution when argument info is available.
 */

import type { SymbolTable, ResolutionContext, TypeAliasSymbol } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { findMethodsInType, selectBestOverload } from '../overload-resolution/index.js';
import { resolveSymbolByName } from './resolve-symbol-by-name.js';
import { resolveMethodInHierarchy } from './resolve-method-in-hierarchy.js';

/**
 * Resolve a method call on a specific type.
 * Handles type aliases by resolving to the underlying type.
 * Supports overload resolution when argument info is available.
 *
 * @param table - The symbol table to search in
 * @param context - The resolution context
 * @param typeName - The type name (may include generics)
 * @param methodName - The name of the method to find
 * @param call - Optional call info for overload resolution
 * @returns The resolved method FQN, or undefined if not found
 */
export function resolveMethodInType(
  table: SymbolTable,
  context: ResolutionContext,
  typeName: string,
  methodName: string,
  call?: ParsedCall
): string | undefined {
  // Remove generics
  const baseType = typeName.split('<')[0]?.trim() ?? typeName;

  // Try to resolve the type FQN
  const symbol = resolveSymbolByName(table, context, baseType);
  let typeFqn = symbol?.fqn || baseType;

  // If it's a type alias, resolve to the underlying type
  if (symbol?.kind === 'typealias') {
    const aliasSymbol = symbol as TypeAliasSymbol;
    const underlyingBaseType = aliasSymbol.aliasedType.split('<')[0]?.trim() ?? aliasSymbol.aliasedType;
    const underlyingSymbol = resolveSymbolByName(table, context, underlyingBaseType);
    if (underlyingSymbol) {
      typeFqn = underlyingSymbol.fqn;
    }
  }

  // Find all methods with this name in the type
  const candidates = findMethodsInType(table, typeFqn, methodName);

  if (candidates.length === 0) {
    // Check type hierarchy
    return resolveMethodInHierarchy(table, context, typeFqn, methodName, call);
  }

  if (candidates.length === 1 && candidates[0]) {
    return candidates[0].fqn;
  }

  // Multiple candidates - use overload resolution
  const best = selectBestOverload(candidates, call);
  return best?.fqn;
}
