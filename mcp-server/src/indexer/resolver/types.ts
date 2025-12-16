/**
 * Symbol Resolver Types
 *
 * Type definitions for the symbol resolution system.
 */

import type { SourceLocation, ParsedFile, ParsedClass, ParsedFunction, SupportedLanguage } from '../types.js';

// =============================================================================
// Symbol Table Types
// =============================================================================

/**
 * Represents a symbol (class, interface, function, property) in the symbol table.
 */
export interface Symbol {
  /** Simple name (e.g., "UserService") */
  name: string;
  /** Fully qualified name (e.g., "com.example.service.UserService") */
  fqn: string;
  /** Symbol kind */
  kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation' | 'function' | 'property' | 'typealias';
  /** File where the symbol is defined */
  filePath: string;
  /** Location in the source file */
  location: SourceLocation;
  /** Parent symbol FQN (for nested classes, methods, etc.) */
  parentFqn?: string;
  /** For functions: the class/interface that declares this function */
  declaringTypeFqn?: string;
  /** For extension functions: the receiver type */
  receiverType?: string;
  /** Package name */
  packageName?: string;
}

/**
 * Represents a class/interface/object symbol with additional metadata.
 */
export interface ClassSymbol extends Symbol {
  kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation';
  /** Superclass FQN (resolved) */
  superClass?: string;
  /** Interface FQNs (resolved) */
  interfaces: string[];
  /** Kotlin-specific: is this a data class? */
  isData?: boolean;
  /** Kotlin-specific: is this a sealed class? */
  isSealed?: boolean;
  /** Is this an abstract class/interface? */
  isAbstract?: boolean;
}

/**
 * Represents a function symbol with additional function-specific metadata.
 */
export interface FunctionSymbol extends Symbol {
  kind: 'function';
  /** Parameter types (for overload resolution) */
  parameterTypes: string[];
  /** Return type */
  returnType?: string;
  /** Is this an extension function? */
  isExtension: boolean;
  /** Is this an operator function? */
  isOperator?: boolean;
  /** Is this an infix function? */
  isInfix?: boolean;
  /** Kotlin-specific: is this a suspend function? */
  isSuspend?: boolean;
  /** Kotlin-specific: is this an inline function? */
  isInline?: boolean;
}

/**
 * Represents a type alias symbol.
 */
export interface TypeAliasSymbol extends Symbol {
  kind: 'typealias';
  /** The aliased type (e.g., "List<String>" for "typealias StringList = List<String>") */
  aliasedType: string;
}

/**
 * Represents a property symbol with additional metadata.
 */
export interface PropertySymbol extends Symbol {
  kind: 'property';
  /** Property type */
  type?: string;
  /** Is this a val (immutable) or var (mutable)? */
  isVal?: boolean;
}

/**
 * Global symbol table built from all parsed files.
 */
export interface SymbolTable {
  /** All symbols indexed by FQN */
  byFqn: Map<string, Symbol>;
  /** Symbols indexed by simple name (for fast lookup) */
  byName: Map<string, Symbol[]>;
  /** Function symbols indexed by name (supports overloading) */
  functionsByName: Map<string, FunctionSymbol[]>;
  /** Symbols indexed by package */
  byPackage: Map<string, Symbol[]>;
  /** Type hierarchy: class/interface FQN -> parent FQN */
  typeHierarchy: Map<string, string[]>;
}

/**
 * Context for resolving symbols within a specific file/scope.
 */
export interface ResolutionContext {
  /** Current file being resolved */
  currentFile: ParsedFile;
  /** Language of the current file (for stdlib lookup) */
  language: SupportedLanguage;
  /** Imports available in the current file */
  imports: Map<string, string>; // simpleName -> FQN
  /** Wildcard imports (packages to search) */
  wildcardImports: string[];
  /** Current class context (for resolving this.method()) */
  currentClass?: ParsedClass;
  /** Current function context */
  currentFunction?: ParsedFunction;
  /** Local variables and their types */
  localVariables: Map<string, string>; // varName -> typeFQN
}

/**
 * Statistics about symbol resolution results.
 */
export interface ResolutionStats {
  /** Total number of calls in all files */
  totalCalls: number;
  /** Number of successfully resolved calls */
  resolvedCalls: number;
  /** Number of unresolved calls */
  unresolvedCalls: number;
  /** Resolution success rate (0-1) */
  resolutionRate: number;
}
