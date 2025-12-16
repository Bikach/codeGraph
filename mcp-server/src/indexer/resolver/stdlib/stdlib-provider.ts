/**
 * Standard Library Provider Interface
 *
 * Abstraction for language-specific standard library symbol resolution.
 * Each supported language implements this interface to provide its stdlib symbols.
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { SupportedLanguage } from '../../types.js';

/**
 * Interface for providing standard library symbols for a specific language.
 * Used by the resolver to look up stdlib functions and classes.
 */
export interface StdlibProvider {
  /**
   * Languages this provider supports.
   * Some providers may support multiple languages (e.g., 'kotlin' and 'java' share Java stdlib).
   */
  readonly languages: readonly SupportedLanguage[];

  /**
   * Default wildcard imports that are implicitly available in this language.
   * For Kotlin: ['kotlin', 'kotlin.collections', 'kotlin.text', ...]
   * For Java: ['java.lang']
   * For TypeScript/JavaScript: [] (no wildcard imports by default)
   */
  readonly defaultWildcardImports: readonly string[];

  /**
   * Lookup a stdlib function by simple name.
   * @param name - Simple function name (e.g., 'println', 'listOf')
   * @returns The function symbol if found, undefined otherwise
   */
  lookupFunction(name: string): FunctionSymbol | undefined;

  /**
   * Lookup a stdlib class/interface by simple name.
   * @param name - Simple class name (e.g., 'String', 'List', 'Map')
   * @returns The class symbol if found, undefined otherwise
   */
  lookupClass(name: string): ClassSymbol | undefined;

  /**
   * Lookup a static method on a stdlib class.
   * Used for patterns like `UUID.randomUUID()`, `System.currentTimeMillis()`.
   * @param qualifiedName - "ClassName.methodName" format (e.g., 'UUID.randomUUID')
   * @returns The function symbol if found, undefined otherwise
   */
  lookupStaticMethod(qualifiedName: string): FunctionSymbol | undefined;

  /**
   * Check if a symbol name is a known stdlib symbol.
   * Useful for quick filtering before detailed lookup.
   */
  isKnownSymbol(name: string): boolean;

  /**
   * Get all stdlib symbols (for debugging/introspection).
   */
  getAllSymbols(): Map<string, Symbol>;
}

/**
 * Null object pattern for languages without stdlib support.
 * Returns undefined for all lookups.
 */
export class NullStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[] = [];
  readonly defaultWildcardImports: readonly string[] = [];

  lookupFunction(_name: string): FunctionSymbol | undefined {
    return undefined;
  }

  lookupClass(_name: string): ClassSymbol | undefined {
    return undefined;
  }

  lookupStaticMethod(_qualifiedName: string): FunctionSymbol | undefined {
    return undefined;
  }

  isKnownSymbol(_name: string): boolean {
    return false;
  }

  getAllSymbols(): Map<string, Symbol> {
    return new Map();
  }
}
