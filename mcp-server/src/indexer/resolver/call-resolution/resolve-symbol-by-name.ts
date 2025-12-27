/**
 * Resolve a symbol by simple name using the resolution context.
 */

import type { Symbol, SymbolTable, ResolutionContext } from '../types.js';
import { getStdlibProvider } from '../stdlib/stdlib-registry.js';

/**
 * Resolve a symbol by simple name using the resolution context.
 *
 * Resolution strategy (by priority):
 * 1. Check imports
 * 2. Check same package
 * 3. Check wildcard imports
 * 4. Check by simple name (if unique)
 * 5. Check stdlib classes (language-specific)
 *
 * @param table - The symbol table to search in
 * @param context - The resolution context with imports and current file info
 * @param name - The simple name to resolve
 * @returns The resolved symbol, or undefined if not found
 */
export function resolveSymbolByName(
  table: SymbolTable,
  context: ResolutionContext,
  name: string
): Symbol | undefined {
  // 1. Check imports
  const importedFqn = context.imports.get(name);
  if (importedFqn && table.byFqn.has(importedFqn)) {
    return table.byFqn.get(importedFqn);
  }

  // 2. Check same package
  const packageName = context.currentFile.packageName;
  if (packageName) {
    const samePackageFqn = `${packageName}.${name}`;
    if (table.byFqn.has(samePackageFqn)) {
      return table.byFqn.get(samePackageFqn);
    }
  }

  // 3. Check wildcard imports
  for (const wildcardPackage of context.wildcardImports) {
    const wildcardFqn = `${wildcardPackage}.${name}`;
    if (table.byFqn.has(wildcardFqn)) {
      return table.byFqn.get(wildcardFqn);
    }
  }

  // 4. Check by simple name (if unique)
  const candidates = table.byName.get(name);
  if (candidates && candidates.length === 1) {
    return candidates[0];
  }

  // 5. Check stdlib classes (language-specific via provider)
  const stdlibProvider = getStdlibProvider(context.language);
  const stdlibClass = stdlibProvider.lookupClass(name);
  if (stdlibClass) {
    return stdlibClass;
  }

  return undefined;
}
