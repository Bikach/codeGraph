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
  ParsedCall,
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

import { getStdlibProvider, getDefaultWildcardImports } from './stdlib/stdlib-registry.js';

// Import utility functions
import { getClassFqn } from './utils/index.js';

// Import overload resolution functions
import {
  selectBestOverload,
  findMethodsInType,
  findFunctionsInPackage,
  isTypeCompatible,
} from './overload-resolution/index.js';

// Import type hierarchy functions
import { buildTypeHierarchy } from './type-hierarchy/index.js';

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

/**
 * Resolve a single call to its target FQN.
 * Returns undefined if the call cannot be resolved.
 * Supports overload resolution using argument types from the call.
 */
function resolveCall(table: SymbolTable, context: ResolutionContext, call: ParsedCall): string | undefined {
  const { name, receiver, receiverType } = call;

  // 0. Check for qualified call (receiver is already an FQN like "com.example.Utils")
  if (receiver && receiver.includes('.')) {
    const resolved = resolveQualifiedCall(table, receiver, name, call);
    if (resolved) return resolved;
  }

  // 0.5. Check for constructor call (no receiver, name matches a class)
  if (!receiver) {
    const constructorFqn = resolveConstructorCall(table, context, name, call);
    if (constructorFqn) return constructorFqn;
  }

  // 1. If receiver type is explicit, look for method in that type
  if (receiverType) {
    const resolved = resolveMethodInType(table, context, receiverType, name, call);
    if (resolved) return resolved;
  }

  // 2. If there's a receiver expression, try to determine its type
  if (receiver) {
    // Check if receiver is a local variable with known type
    const localType = context.localVariables.get(receiver);
    if (localType) {
      const resolved = resolveMethodInType(table, context, localType, name, call);
      if (resolved) return resolved;
    }

    // Check if receiver is a property in the current class
    if (context.currentClass) {
      const prop = context.currentClass.properties.find((p) => p.name === receiver);
      if (prop?.type) {
        const resolved = resolveMethodInType(table, context, prop.type, name, call);
        if (resolved) return resolved;
      }
    }

    // Check if receiver is a class name (static call / companion object)
    const receiverSymbol = resolveSymbolByName(table, context, receiver);
    if (receiverSymbol && (receiverSymbol.kind === 'class' || receiverSymbol.kind === 'object' || receiverSymbol.kind === 'enum')) {
      // Look for method in companion object or static context (with overload resolution)
      const companionFqn = `${receiverSymbol.fqn}.Companion`;
      const companionCandidates = findMethodsInType(table, companionFqn, name);
      if (companionCandidates.length > 0) {
        const best = selectBestOverload(companionCandidates, call);
        if (best) return best.fqn;
      }

      // Try direct method lookup (for objects, with overload resolution)
      const directCandidates = findMethodsInType(table, receiverSymbol.fqn, name);
      if (directCandidates.length > 0) {
        const best = selectBestOverload(directCandidates, call);
        if (best) return best.fqn;
      }

      // For enums, resolve synthetic static methods (valueOf, values, entries)
      if (receiverSymbol.kind === 'enum') {
        const enumStaticMethod = resolveEnumStaticMethod(receiverSymbol.fqn, name);
        if (enumStaticMethod) return enumStaticMethod;
      }
    }
  }

  // 3. No receiver - look in current class first (with overload resolution)
  if (context.currentClass) {
    const classFqn = getClassFqn(context);
    const classCandidates = findMethodsInType(table, classFqn, name);

    if (classCandidates.length > 0) {
      const best = selectBestOverload(classCandidates, call);
      if (best) return best.fqn;
    }

    // Check superclass hierarchy (with overload resolution)
    const superMethod = resolveMethodInHierarchy(table, context, classFqn, name, call);
    if (superMethod) return superMethod;
  }

  // 4. Look in imported symbols
  const importedFqn = context.imports.get(name);
  if (importedFqn) {
    return importedFqn;
  }

  // 5. Look in same package (with overload resolution)
  const packageName = context.currentFile.packageName;
  if (packageName) {
    const packageCandidates = findFunctionsInPackage(table, packageName, name);
    if (packageCandidates.length > 0) {
      const best = selectBestOverload(packageCandidates, call);
      if (best) return best.fqn;
    }
  }

  // 6. Look in wildcard imports (with overload resolution)
  for (const wildcardPackage of context.wildcardImports) {
    const wildcardCandidates = findFunctionsInPackage(table, wildcardPackage, name);
    if (wildcardCandidates.length > 0) {
      const best = selectBestOverload(wildcardCandidates, call);
      if (best) return best.fqn;
    }
  }

  // 7. Check for extension functions (with overload resolution)
  if (receiver) {
    const extensionFunc = resolveExtensionFunction(table, context, receiver, name, call);
    if (extensionFunc) return extensionFunc;
  }

  // 8. Top-level function in any package (last resort, with overload resolution)
  const candidates = table.functionsByName.get(name);
  if (candidates && candidates.length > 0) {
    if (candidates.length === 1 && candidates[0]) {
      return candidates[0].fqn;
    }
    // Multiple candidates - use overload resolution
    const best = selectBestOverload(candidates, call);
    if (best) return best.fqn;
  }

  // 9. Check stdlib functions (language-specific via provider)
  const stdlibProvider = getStdlibProvider(context.language);
  const stdlibFunc = stdlibProvider.lookupFunction(name);
  if (stdlibFunc) {
    return stdlibFunc.fqn;
  }

  // 10. Check stdlib static methods (for qualified calls like UUID.randomUUID)
  if (receiver) {
    const staticMethod = stdlibProvider.lookupStaticMethod(`${receiver}.${name}`);
    if (staticMethod) {
      return staticMethod.fqn;
    }
  }

  // Could not resolve
  return undefined;
}

/**
 * Check if a call without receiver is a constructor call.
 * In Kotlin, `User("John")` can be a constructor call if `User` is a class.
 * Returns the class FQN if it's a constructor, undefined otherwise.
 */
function resolveConstructorCall(
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

/**
 * Resolve a qualified call where the receiver is already an FQN.
 * Examples: com.example.Utils.parse(), java.lang.System.currentTimeMillis()
 */
function resolveQualifiedCall(
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

/**
 * Resolve a method call on a specific type.
 * Handles type aliases by resolving to the underlying type.
 * Supports overload resolution when argument info is available.
 */
function resolveMethodInType(
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

/**
 * Resolve a method by traversing the type hierarchy.
 * Supports overload resolution when call info is available.
 */
function resolveMethodInHierarchy(
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

/**
 * Resolve a symbol by simple name using the resolution context.
 */
function resolveSymbolByName(table: SymbolTable, context: ResolutionContext, name: string): Symbol | undefined {
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

/**
 * Resolve an extension function call.
 * Supports overload resolution when multiple extension functions match.
 */
function resolveExtensionFunction(
  table: SymbolTable,
  context: ResolutionContext,
  receiver: string,
  functionName: string,
  call?: ParsedCall
): string | undefined {
  // Get all functions with this name
  const allCandidates = table.functionsByName.get(functionName);
  if (!allCandidates || allCandidates.length === 0) return undefined;

  // Filter to extension functions
  const extensionFuncs = allCandidates.filter((f) => f.isExtension);
  if (extensionFuncs.length === 0) return undefined;

  // Try to determine receiver type
  let receiverType: string | undefined;

  // Check local variables
  receiverType = context.localVariables.get(receiver);

  // Check class properties
  if (!receiverType && context.currentClass) {
    const prop = context.currentClass.properties.find((p) => p.name === receiver);
    receiverType = prop?.type;
  }

  // Filter by receiver type if known
  let matchingExtensions = extensionFuncs;
  if (receiverType) {
    const baseReceiverType = receiverType.split('<')[0]?.trim() ?? receiverType;
    matchingExtensions = extensionFuncs.filter((ext) => {
      if (!ext.receiverType) return false;
      const extReceiverBase = ext.receiverType.split('<')[0]?.trim() ?? ext.receiverType;
      return extReceiverBase === baseReceiverType || extReceiverBase === receiverType;
    });

    // If no exact match, try type compatibility
    if (matchingExtensions.length === 0) {
      matchingExtensions = extensionFuncs.filter((ext) => {
        if (!ext.receiverType) return false;
        const extReceiverBase = ext.receiverType.split('<')[0]?.trim() ?? ext.receiverType;
        return isTypeCompatible(baseReceiverType, extReceiverBase);
      });
    }
  }

  // If still no matches, fall back to all extension functions
  if (matchingExtensions.length === 0) {
    matchingExtensions = extensionFuncs;
  }

  // Use overload resolution if multiple candidates
  if (matchingExtensions.length === 1 && matchingExtensions[0]) {
    return matchingExtensions[0].fqn;
  }

  const best = selectBestOverload(matchingExtensions, call);
  return best?.fqn;
}

/**
 * Resolve synthetic static methods on enum types.
 * Kotlin/Java enums have compiler-generated methods: valueOf, values, entries.
 *
 * @param enumFqn - Fully qualified name of the enum (e.g., "com.example.Role")
 * @param methodName - Name of the method being called
 * @returns FQN of the synthetic method, or undefined if not a known enum method
 */
function resolveEnumStaticMethod(enumFqn: string, methodName: string): string | undefined {
  // Kotlin/Java enum synthetic methods
  const enumStaticMethods: Record<string, boolean> = {
    valueOf: true, // Enum.valueOf(String): E
    values: true, // Enum.values(): Array<E>
    entries: true, // Kotlin 1.9+ Enum.entries: EnumEntries<E>
  };

  if (enumStaticMethods[methodName]) {
    return `${enumFqn}.${methodName}`;
  }

  return undefined;
}

// =============================================================================
// Utility Functions (re-exported from utils/)
// =============================================================================

export { getResolutionStats, lookupSymbol, findSymbols } from './utils/index.js';
