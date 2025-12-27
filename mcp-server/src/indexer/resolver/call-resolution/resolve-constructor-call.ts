/**
 * Check if a call without receiver is a constructor call.
 * In Kotlin, `User("John")` can be a constructor call if `User` is a class.
 * Returns the class FQN if it's a constructor, undefined otherwise.
 */

import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { resolveSymbolByName } from './resolve-symbol-by-name.js';

/**
 * Check if a call without receiver is a constructor call.
 * In Kotlin, `User("John")` can be a constructor call if `User` is a class.
 * Returns the class FQN with <init> marker if it's a constructor, undefined otherwise.
 *
 * @param table - The symbol table to search in
 * @param context - The resolution context
 * @param name - The name being called (potential class name)
 * @param _call - The call info (unused but kept for consistency)
 * @returns The constructor FQN (e.g., "com.example.User.<init>"), or undefined
 */
export function resolveConstructorCall(
  table: SymbolTable,
  context: ResolutionContext,
  name: string,
  _call: ParsedCall
): string | undefined {
  // Check if name starts with uppercase (Kotlin convention for classes)
  // This is a heuristic - not all class names start with uppercase
  const startsWithUppercase = name.length > 0 && name[0] === name[0]?.toUpperCase() && name[0] !== name[0]?.toLowerCase();

  if (!startsWithUppercase) {
    // Probably not a constructor call
    return undefined;
  }

  // Try to find a class with this name
  const classSymbol = resolveSymbolByName(table, context, name);

  if (classSymbol && (classSymbol.kind === 'class' || classSymbol.kind === 'enum' || classSymbol.kind === 'annotation')) {
    // This is a constructor call - return the class FQN with <init> marker
    // Note: We return the class FQN directly, as constructors are typically
    // represented as the class instantiation in the call graph
    return `${classSymbol.fqn}.<init>`;
  }

  // Also check for data class copy() pattern, etc.
  return undefined;
}
