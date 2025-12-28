/**
 * Symbol Resolver for the CodeGraph Indexer
 *
 * This module transforms parsed files with unresolved calls into resolved files
 * with fully qualified names (FQNs) for all symbols.
 *
 * Resolution strategy (by priority):
 * 1. Explicit receiver type (user.save() where user: UserRepository)
 * 2. Same class/file methods (this.method() or unqualified method())
 * 3. Imported symbols (import com.example.Service)
 * 4. Same package symbols
 * 5. Standard library (language-specific via StdlibProvider)
 */

// Re-export types
export type {
  Symbol,
  FunctionSymbol,
  ClassSymbol,
  TypeAliasSymbol,
  PropertySymbol,
  SymbolTable,
  ResolutionContext,
  ResolutionStats,
} from './types.js';

// Re-export stdlib provider types and registry
export type { StdlibProvider } from './stdlib/stdlib-provider.js';
export { NullStdlibProvider } from './stdlib/stdlib-provider.js';
export { getStdlibProvider, getDefaultWildcardImports, stdlibRegistry, CompositeStdlibProvider } from './stdlib/stdlib-registry.js';

// Re-export stdlib lookup functions for backward compatibility
export {
  lookupKotlinStdlibFunction,
  lookupKotlinStdlibClass,
  KOTLIN_STDLIB_FUNCTIONS,
  KOTLIN_STDLIB_CLASSES,
  KotlinStdlibProvider,
} from './stdlib/kotlin-stdlib.js';

export {
  lookupJavaStdlibFunction,
  lookupJavaStdlibClass,
  JAVA_STDLIB_FUNCTIONS,
  JAVA_STDLIB_CLASSES,
  JavaStdlibProvider,
} from './stdlib/java-stdlib.js';

// Re-export symbol table functions
export { buildSymbolTable } from './symbol-table/index.js';

// Re-export resolution functions
export { resolveSymbols } from './resolution/index.js';

// Re-export utility functions
export { getResolutionStats, lookupSymbol, findSymbols } from './utils/index.js';
