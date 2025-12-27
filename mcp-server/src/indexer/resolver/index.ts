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
  Symbol,
  FunctionSymbol,
  ClassSymbol,
  TypeAliasSymbol,
  PropertySymbol,
  SymbolTable,
  ResolutionContext,
} from './types.js';

import { getDefaultWildcardImports } from './stdlib/stdlib-registry.js';

// Import type hierarchy functions
import { buildTypeHierarchy } from './type-hierarchy/index.js';

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

// =============================================================================
// Symbol Table Builder
// =============================================================================

/**
 * Build a global symbol table from a collection of parsed files.
 */
export function buildSymbolTable(files: ParsedFile[]): SymbolTable {
  const table: SymbolTable = {
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  };

  for (const file of files) {
    indexFile(table, file);
  }

  // Build type hierarchy after all symbols are indexed
  buildTypeHierarchy(table, files);

  return table;
}

/**
 * Index all symbols from a single file into the symbol table.
 */
function indexFile(table: SymbolTable, file: ParsedFile): void {
  const packageName = file.packageName || '';

  // Index classes (and their nested content)
  for (const cls of file.classes) {
    indexClass(table, cls, packageName, file.filePath);
  }

  // Index top-level functions
  for (const func of file.topLevelFunctions) {
    indexFunction(table, func, packageName, file.filePath, undefined);
  }

  // Index top-level properties
  for (const prop of file.topLevelProperties) {
    const fqn = packageName ? `${packageName}.${prop.name}` : prop.name;
    addSymbol(table, {
      name: prop.name,
      fqn,
      kind: 'property',
      filePath: file.filePath,
      location: prop.location,
      packageName,
    });
  }

  // Index type aliases as TypeAliasSymbol (they can be referenced and resolved)
  for (const alias of file.typeAliases) {
    const fqn = packageName ? `${packageName}.${alias.name}` : alias.name;
    const typeAliasSymbol: TypeAliasSymbol = {
      name: alias.name,
      fqn,
      kind: 'typealias',
      filePath: file.filePath,
      location: alias.location,
      packageName,
      aliasedType: alias.aliasedType,
    };
    addSymbol(table, typeAliasSymbol);
  }

  // Index destructuring declarations (each component becomes a property)
  for (const destructuring of file.destructuringDeclarations) {
    for (let i = 0; i < destructuring.componentNames.length; i++) {
      const componentName = destructuring.componentNames[i];
      if (componentName && componentName !== '_') {
        const propFqn = packageName ? `${packageName}.${componentName}` : componentName;
        const propSymbol: PropertySymbol = {
          name: componentName,
          fqn: propFqn,
          kind: 'property',
          filePath: file.filePath,
          location: destructuring.location,
          packageName,
          type: destructuring.componentTypes?.[i],
          isVal: destructuring.isVal,
        };
        addSymbol(table, propSymbol);
      }
    }
  }

  // Index object expressions for dependency tracking
  // Object expressions implement interfaces/extend classes, so we track those relationships
  for (const objExpr of file.objectExpressions) {
    // Object expressions are anonymous, we track them by location
    const anonymousFqn = packageName
      ? `${packageName}.<anonymous>@${objExpr.location.startLine}`
      : `<anonymous>@${objExpr.location.startLine}`;

    // Add to symbol table for reference tracking (not really lookupable, but useful for analysis)
    addSymbol(table, {
      name: '<anonymous>',
      fqn: anonymousFqn,
      kind: 'object',
      filePath: file.filePath,
      location: objExpr.location,
      packageName,
    });

    // Index functions within object expressions
    for (const func of objExpr.functions) {
      indexFunction(table, func, packageName, file.filePath, anonymousFqn);
    }
  }
}

/**
 * Index a class and all its members into the symbol table.
 */
function indexClass(
  table: SymbolTable,
  cls: ParsedClass,
  packageName: string,
  filePath: string,
  parentFqn?: string
): void {
  const fqn = parentFqn
    ? `${parentFqn}.${cls.name}`
    : packageName
      ? `${packageName}.${cls.name}`
      : cls.name;

  // Add the class itself with full metadata
  const classSymbol: ClassSymbol = {
    name: cls.name,
    fqn,
    kind: cls.kind,
    filePath,
    location: cls.location,
    parentFqn,
    packageName,
    // Inheritance info (will be resolved to FQN later in buildTypeHierarchy)
    superClass: cls.superClass,
    interfaces: cls.interfaces,
    // Kotlin-specific metadata
    isData: cls.isData || undefined,
    isSealed: cls.isSealed || undefined,
    isAbstract: cls.isAbstract || undefined,
  };
  addSymbol(table, classSymbol);

  // Index functions
  for (const func of cls.functions) {
    indexFunction(table, func, packageName, filePath, fqn);
  }

  // Index properties with full metadata
  for (const prop of cls.properties) {
    const propFqn = `${fqn}.${prop.name}`;
    const propSymbol: PropertySymbol = {
      name: prop.name,
      fqn: propFqn,
      kind: 'property',
      filePath,
      location: prop.location,
      parentFqn: fqn,
      packageName,
      type: prop.type,
      isVal: prop.isVal,
    };
    addSymbol(table, propSymbol);
  }

  // Index nested classes
  for (const nested of cls.nestedClasses) {
    indexClass(table, nested, packageName, filePath, fqn);
  }

  // Index companion object
  if (cls.companionObject) {
    // Use actual companion object name (might be named, e.g., "companion object Factory")
    const companionName = cls.companionObject.name !== '<anonymous>' ? cls.companionObject.name : 'Companion';
    const companionFqn = `${fqn}.${companionName}`;

    const companionSymbol: ClassSymbol = {
      name: companionName,
      fqn: companionFqn,
      kind: 'object',
      filePath,
      location: cls.companionObject.location,
      parentFqn: fqn,
      packageName,
      superClass: cls.companionObject.superClass,
      interfaces: cls.companionObject.interfaces,
    };
    addSymbol(table, companionSymbol);

    // Index companion functions and properties
    for (const func of cls.companionObject.functions) {
      indexFunction(table, func, packageName, filePath, companionFqn);
    }
    for (const prop of cls.companionObject.properties) {
      const propFqn = `${companionFqn}.${prop.name}`;
      const propSymbol: PropertySymbol = {
        name: prop.name,
        fqn: propFqn,
        kind: 'property',
        filePath,
        location: prop.location,
        parentFqn: companionFqn,
        packageName,
        type: prop.type,
        isVal: prop.isVal,
      };
      addSymbol(table, propSymbol);
    }
  }
}

/**
 * Index a function into the symbol table.
 */
function indexFunction(
  table: SymbolTable,
  func: ParsedFunction,
  packageName: string,
  filePath: string,
  declaringTypeFqn?: string
): void {
  const fqn = declaringTypeFqn ? `${declaringTypeFqn}.${func.name}` : packageName ? `${packageName}.${func.name}` : func.name;

  const functionSymbol: FunctionSymbol = {
    name: func.name,
    fqn,
    kind: 'function',
    filePath,
    location: func.location,
    declaringTypeFqn,
    receiverType: func.receiverType,
    packageName,
    parameterTypes: func.parameters.map((p) => p.type || 'Any'),
    returnType: func.returnType,
    isExtension: func.isExtension,
    isOperator: func.isOperator,
    isInfix: func.isInfix,
    // Kotlin-specific metadata
    isSuspend: func.isSuspend || undefined,
    isInline: func.isInline || undefined,
  };

  addSymbol(table, functionSymbol);

  // Also add to function-specific index
  const existing = table.functionsByName.get(func.name) || [];
  existing.push(functionSymbol);
  table.functionsByName.set(func.name, existing);
}

/**
 * Add a symbol to all relevant indexes in the symbol table.
 */
function addSymbol(table: SymbolTable, symbol: Symbol): void {
  // Index by FQN
  table.byFqn.set(symbol.fqn, symbol);

  // Index by simple name
  const byName = table.byName.get(symbol.name) || [];
  byName.push(symbol);
  table.byName.set(symbol.name, byName);

  // Index by package
  if (symbol.packageName) {
    const byPackage = table.byPackage.get(symbol.packageName) || [];
    byPackage.push(symbol);
    table.byPackage.set(symbol.packageName, byPackage);
  }
}


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
