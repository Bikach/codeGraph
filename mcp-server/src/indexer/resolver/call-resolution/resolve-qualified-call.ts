/**
 * Resolve a qualified call where the receiver is already an FQN.
 * Examples: com.example.Utils.parse(), java.lang.System.currentTimeMillis()
 */

import type { SymbolTable } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { findMethodsInType, selectBestOverload } from '../overload-resolution/index.js';

/**
 * Resolve a qualified call where the receiver is already an FQN.
 * Examples: com.example.Utils.parse(), java.lang.System.currentTimeMillis()
 *
 * @param table - The symbol table to search in
 * @param qualifiedReceiver - The qualified receiver (e.g., "com.example.Utils")
 * @param methodName - The name of the method being called
 * @param call - The call info for overload resolution
 * @returns The resolved method FQN, or undefined if not found
 */
export function resolveQualifiedCall(
  table: SymbolTable,
  qualifiedReceiver: string,
  methodName: string,
  call: ParsedCall
): string | undefined {
  // Try direct FQN lookup
  const directFqn = `${qualifiedReceiver}.${methodName}`;
  if (table.byFqn.has(directFqn)) {
    return directFqn;
  }

  // Check if qualified receiver is a known type (with overload resolution)
  if (table.byFqn.has(qualifiedReceiver)) {
    const candidates = findMethodsInType(table, qualifiedReceiver, methodName);
    if (candidates.length > 0) {
      const best = selectBestOverload(candidates, call);
      if (best) return best.fqn;
    }

    // Try companion object
    const companionFqn = `${qualifiedReceiver}.Companion`;
    const companionCandidates = findMethodsInType(table, companionFqn, methodName);
    if (companionCandidates.length > 0) {
      const best = selectBestOverload(companionCandidates, call);
      if (best) return best.fqn;
    }
  }

  // Try to find as a top-level function in the package
  // e.g., com.example.utils.parse() where parse is a top-level function in com.example.utils
  const lastDotIndex = qualifiedReceiver.lastIndexOf('.');
  if (lastDotIndex > 0) {
    const packagePart = qualifiedReceiver.substring(0, lastDotIndex);
    const lastPart = qualifiedReceiver.substring(lastDotIndex + 1);

    // Check if lastPart.methodName is a function in packagePart
    // e.g., com.example (package) . Utils (object) . method (function)
    const objectFqn = `${packagePart}.${lastPart}`;
    if (table.byFqn.has(objectFqn)) {
      const candidates = findMethodsInType(table, objectFqn, methodName);
      if (candidates.length > 0) {
        const best = selectBestOverload(candidates, call);
        if (best) return best.fqn;
      }
    }
  }

  return undefined;
}
