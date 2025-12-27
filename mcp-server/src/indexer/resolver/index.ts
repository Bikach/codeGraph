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

import type {
  ParsedFile,
  ParsedClass,
  ParsedFunction,
  ResolvedCall,
  ResolvedFile,
} from '../types.js';

import type {
  SymbolTable,
  ResolutionContext,
} from './types.js';

import { getDefaultWildcardImports } from './stdlib/stdlib-registry.js';

// Import symbol table functions (used in resolveSymbols and re-exported)
import { buildSymbolTable } from './symbol-table/index.js';

// Import call resolution functions
import { resolveCall } from './call-resolution/index.js';

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


// =============================================================================
// Symbol Resolution
// =============================================================================

/**
 * Resolve all symbols in a collection of parsed files.
 * Returns files with resolved call references.
 */
export function resolveSymbols(files: ParsedFile[], symbolTable?: SymbolTable): ResolvedFile[] {
  const table = symbolTable || buildSymbolTable(files);
  return files.map((file) => resolveFile(table, file));
}

/**
 * Resolve symbols in a single file.
 */
function resolveFile(table: SymbolTable, file: ParsedFile): ResolvedFile {
  const context = createResolutionContext(file);
  const resolvedCalls: ResolvedCall[] = [];
  const packageName = file.packageName || '';

  // Resolve calls in top-level functions
  for (const func of file.topLevelFunctions) {
    const funcFqn = packageName ? `${packageName}.${func.name}` : func.name;
    resolvedCalls.push(...resolveCallsInFunction(table, context, func, funcFqn));
  }

  // Resolve calls in classes
  for (const cls of file.classes) {
    resolvedCalls.push(...resolveCallsInClass(table, context, cls, packageName));
  }

  // Resolve calls in object expressions (anonymous objects)
  for (const objExpr of file.objectExpressions) {
    const anonymousFqn = packageName
      ? `${packageName}.<anonymous>@${objExpr.location.startLine}`
      : `<anonymous>@${objExpr.location.startLine}`;

    for (const func of objExpr.functions) {
      const funcFqn = `${anonymousFqn}.${func.name}`;
      resolvedCalls.push(...resolveCallsInFunction(table, context, func, funcFqn));
    }
  }

  return {
    ...file,
    resolvedCalls,
  };
}

/**
 * Create a resolution context for a file.
 */
function createResolutionContext(file: ParsedFile): ResolutionContext {
  const imports = new Map<string, string>();
  const wildcardImports: string[] = [];

  // Process imports
  for (const imp of file.imports) {
    if (imp.isWildcard) {
      // Remove the .* suffix for wildcard imports
      const packagePath = imp.path.replace(/\.\*$/, '');
      wildcardImports.push(packagePath);
    } else {
      // Extract simple name from the import path
      const simpleName = imp.alias || imp.path.split('.').pop()!;
      imports.set(simpleName, imp.path);
    }
  }

  // Add default wildcard imports based on language (from stdlib registry)
  const defaultImports = getDefaultWildcardImports(file.language);
  wildcardImports.push(...defaultImports);

  return {
    currentFile: file,
    language: file.language,
    imports,
    wildcardImports,
    localVariables: new Map(),
  };
}

/**
 * Resolve calls in a class and its members.
 */
function resolveCallsInClass(
  table: SymbolTable,
  context: ResolutionContext,
  cls: ParsedClass,
  packageName: string,
  parentFqn?: string
): ResolvedCall[] {
  const classFqn = parentFqn
    ? `${parentFqn}.${cls.name}`
    : packageName
      ? `${packageName}.${cls.name}`
      : cls.name;

  const resolvedCalls: ResolvedCall[] = [];

  // Update context for this class
  const classContext: ResolutionContext = {
    ...context,
    currentClass: cls,
  };

  // Resolve calls in functions
  for (const func of cls.functions) {
    const funcFqn = `${classFqn}.${func.name}`;
    resolvedCalls.push(...resolveCallsInFunction(table, classContext, func, funcFqn));
  }

  // Resolve calls in nested classes
  for (const nested of cls.nestedClasses) {
    resolvedCalls.push(...resolveCallsInClass(table, context, nested, packageName, classFqn));
  }

  // Resolve calls in companion object
  if (cls.companionObject) {
    const companionFqn = `${classFqn}.Companion`;
    for (const func of cls.companionObject.functions) {
      const funcFqn = `${companionFqn}.${func.name}`;
      resolvedCalls.push(...resolveCallsInFunction(table, classContext, func, funcFqn));
    }
  }

  return resolvedCalls;
}

/**
 * Resolve calls within a function.
 */
function resolveCallsInFunction(
  table: SymbolTable,
  context: ResolutionContext,
  func: ParsedFunction,
  funcFqn: string
): ResolvedCall[] {
  const resolvedCalls: ResolvedCall[] = [];

  // Create function-specific context with parameters as local variables
  const funcContext: ResolutionContext = {
    ...context,
    currentFunction: func,
    localVariables: new Map(context.localVariables),
  };

  // Add function parameters to local variables
  for (const param of func.parameters) {
    if (param.type) {
      funcContext.localVariables.set(param.name, param.type);
    }
  }

  // Resolve each call
  for (const call of func.calls) {
    const resolvedCallee = resolveCall(table, funcContext, call);
    if (resolvedCallee) {
      resolvedCalls.push({
        fromFqn: funcFqn,
        toFqn: resolvedCallee,
        location: call.location,
      });
    }
  }

  return resolvedCalls;
}

// =============================================================================
// Utility Functions (re-exported from utils/)
// =============================================================================

export { getResolutionStats, lookupSymbol, findSymbols } from './utils/index.js';
