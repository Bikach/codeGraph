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
 * 5. Standard library (kotlin.*, kotlinx.*, java.*)
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
  ResolutionStats,
} from './types.js';

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

/**
 * Build the type hierarchy (extends/implements relationships).
 */
function buildTypeHierarchy(table: SymbolTable, files: ParsedFile[]): void {
  for (const file of files) {
    const packageName = file.packageName || '';
    for (const cls of file.classes) {
      buildClassHierarchy(table, cls, packageName);
    }
  }
}

/**
 * Build hierarchy for a single class.
 */
function buildClassHierarchy(table: SymbolTable, cls: ParsedClass, packageName: string, parentFqn?: string): void {
  const fqn = parentFqn
    ? `${parentFqn}.${cls.name}`
    : packageName
      ? `${packageName}.${cls.name}`
      : cls.name;

  const parents: string[] = [];

  // Add superclass
  if (cls.superClass) {
    const resolvedParent = resolveTypeName(table, cls.superClass, packageName);
    if (resolvedParent) {
      parents.push(resolvedParent);
    } else {
      // Keep unresolved for now (might be external)
      parents.push(cls.superClass);
    }
  }

  // Add interfaces
  for (const iface of cls.interfaces) {
    const resolvedIface = resolveTypeName(table, iface, packageName);
    if (resolvedIface) {
      parents.push(resolvedIface);
    } else {
      parents.push(iface);
    }
  }

  if (parents.length > 0) {
    table.typeHierarchy.set(fqn, parents);
  }

  // Process nested classes
  for (const nested of cls.nestedClasses) {
    buildClassHierarchy(table, nested, packageName, fqn);
  }
}

/**
 * Try to resolve a simple type name to its FQN.
 */
function resolveTypeName(table: SymbolTable, typeName: string, currentPackage: string): string | undefined {
  // Remove generics for lookup
  const baseName = typeName.split('<')[0]?.trim() ?? typeName;

  // 1. Check if it's already an FQN
  if (table.byFqn.has(baseName)) {
    return baseName;
  }

  // 2. Check same package
  const samePackageFqn = currentPackage ? `${currentPackage}.${baseName}` : baseName;
  if (table.byFqn.has(samePackageFqn)) {
    return samePackageFqn;
  }

  // 3. Check by simple name (might find it in another package)
  const candidates = table.byName.get(baseName);
  if (candidates && candidates.length === 1 && candidates[0]) {
    return candidates[0].fqn;
  }

  return undefined;
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

  // Add default Kotlin imports
  const defaultKotlinImports = ['kotlin', 'kotlin.collections', 'kotlin.text', 'kotlin.io', 'kotlin.ranges', 'kotlin.sequences', 'kotlin.annotation'];
  wildcardImports.push(...defaultKotlinImports);

  return {
    currentFile: file,
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
 */
function resolveCall(table: SymbolTable, context: ResolutionContext, call: ParsedCall): string | undefined {
  const { name, receiver, receiverType } = call;

  // 1. If receiver type is explicit, look for method in that type
  if (receiverType) {
    const resolved = resolveMethodInType(table, context, receiverType, name);
    if (resolved) return resolved;
  }

  // 2. If there's a receiver expression, try to determine its type
  if (receiver) {
    // Check if receiver is a local variable with known type
    const localType = context.localVariables.get(receiver);
    if (localType) {
      const resolved = resolveMethodInType(table, context, localType, name);
      if (resolved) return resolved;
    }

    // Check if receiver is a property in the current class
    if (context.currentClass) {
      const prop = context.currentClass.properties.find((p) => p.name === receiver);
      if (prop?.type) {
        const resolved = resolveMethodInType(table, context, prop.type, name);
        if (resolved) return resolved;
      }
    }

    // Check if receiver is a class name (static call / companion object)
    const receiverSymbol = resolveSymbolByName(table, context, receiver);
    if (receiverSymbol && (receiverSymbol.kind === 'class' || receiverSymbol.kind === 'object')) {
      // Look for method in companion object or static context
      const companionFqn = `${receiverSymbol.fqn}.Companion`;
      const companionMethod = table.byFqn.get(`${companionFqn}.${name}`);
      if (companionMethod) return companionMethod.fqn;

      // Try direct method lookup (for objects)
      const directMethod = table.byFqn.get(`${receiverSymbol.fqn}.${name}`);
      if (directMethod) return directMethod.fqn;
    }
  }

  // 3. No receiver - look in current class first
  if (context.currentClass) {
    const classFqn = getClassFqn(context);
    const methodFqn = `${classFqn}.${name}`;
    if (table.byFqn.has(methodFqn)) {
      return methodFqn;
    }

    // Check superclass hierarchy
    const superMethod = resolveMethodInHierarchy(table, context, classFqn, name);
    if (superMethod) return superMethod;
  }

  // 4. Look in imported symbols
  const importedFqn = context.imports.get(name);
  if (importedFqn) {
    return importedFqn;
  }

  // 5. Look in same package
  const packageName = context.currentFile.packageName;
  if (packageName) {
    const samePackageFqn = `${packageName}.${name}`;
    if (table.byFqn.has(samePackageFqn)) {
      return samePackageFqn;
    }
  }

  // 6. Look in wildcard imports
  for (const wildcardPackage of context.wildcardImports) {
    const wildcardFqn = `${wildcardPackage}.${name}`;
    if (table.byFqn.has(wildcardFqn)) {
      return wildcardFqn;
    }
  }

  // 7. Check for extension functions
  if (receiver) {
    const extensionFunc = resolveExtensionFunction(table, context, receiver, name);
    if (extensionFunc) return extensionFunc;
  }

  // 8. Top-level function in any package (last resort)
  const candidates = table.functionsByName.get(name);
  if (candidates && candidates.length === 1 && candidates[0]) {
    return candidates[0].fqn;
  }

  // Could not resolve
  return undefined;
}

/**
 * Resolve a method call on a specific type.
 * Handles type aliases by resolving to the underlying type.
 */
function resolveMethodInType(
  table: SymbolTable,
  context: ResolutionContext,
  typeName: string,
  methodName: string
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

  // Look for method in the type
  const methodFqn = `${typeFqn}.${methodName}`;
  if (table.byFqn.has(methodFqn)) {
    return methodFqn;
  }

  // Check type hierarchy
  return resolveMethodInHierarchy(table, context, typeFqn, methodName);
}

/**
 * Resolve a method by traversing the type hierarchy.
 */
function resolveMethodInHierarchy(
  table: SymbolTable,
  _context: ResolutionContext,
  typeFqn: string,
  methodName: string
): string | undefined {
  const parents = table.typeHierarchy.get(typeFqn);
  if (!parents) return undefined;

  for (const parentFqn of parents) {
    // Check parent for the method
    const parentMethodFqn = `${parentFqn}.${methodName}`;
    if (table.byFqn.has(parentMethodFqn)) {
      return parentMethodFqn;
    }

    // Recursively check parent's parents
    const inherited = resolveMethodInHierarchy(table, _context, parentFqn, methodName);
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

  return undefined;
}

/**
 * Resolve an extension function call.
 */
function resolveExtensionFunction(
  table: SymbolTable,
  context: ResolutionContext,
  receiver: string,
  functionName: string
): string | undefined {
  // Get all functions with this name
  const candidates = table.functionsByName.get(functionName);
  if (!candidates || candidates.length === 0) return undefined;

  // Filter to extension functions
  const extensionFuncs = candidates.filter((f) => f.isExtension);
  if (extensionFuncs.length === 0 || !extensionFuncs[0]) return undefined;

  // Try to determine receiver type
  let receiverType: string | undefined;

  // Check local variables
  receiverType = context.localVariables.get(receiver);

  // Check class properties
  if (!receiverType && context.currentClass) {
    const prop = context.currentClass.properties.find((p) => p.name === receiver);
    receiverType = prop?.type;
  }

  if (!receiverType) {
    // Can't determine receiver type, return first matching extension function
    // This is a heuristic - might not be accurate
    return extensionFuncs[0].fqn;
  }

  // Find extension function matching the receiver type
  const baseReceiverType = receiverType.split('<')[0]?.trim() ?? receiverType;
  for (const ext of extensionFuncs) {
    if (ext.receiverType) {
      const extReceiverBase = ext.receiverType.split('<')[0]?.trim() ?? ext.receiverType;
      // Simple match - could be improved with type hierarchy
      if (extReceiverBase === baseReceiverType || extReceiverBase === receiverType) {
        return ext.fqn;
      }
    }
  }

  // Fallback: return first matching extension
  return extensionFuncs[0].fqn;
}

/**
 * Get the FQN of the current class from context.
 */
function getClassFqn(context: ResolutionContext): string {
  if (!context.currentClass) return '';
  const packageName = context.currentFile.packageName || '';
  return packageName ? `${packageName}.${context.currentClass.name}` : context.currentClass.name;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get statistics about the resolution results.
 */
export function getResolutionStats(resolvedFiles: ResolvedFile[]): ResolutionStats {
  let totalCalls = 0;
  let resolvedCalls = 0;

  for (const file of resolvedFiles) {
    // Count total calls from all functions
    for (const func of file.topLevelFunctions) {
      totalCalls += func.calls.length;
    }
    for (const cls of file.classes) {
      totalCalls += countCallsInClass(cls);
    }

    // Count resolved calls
    resolvedCalls += file.resolvedCalls.length;
  }

  return {
    totalCalls,
    resolvedCalls,
    unresolvedCalls: totalCalls - resolvedCalls,
    resolutionRate: totalCalls > 0 ? resolvedCalls / totalCalls : 1,
  };
}

/**
 * Count all calls in a class (including nested classes and companion).
 */
function countCallsInClass(cls: ParsedClass): number {
  let count = 0;

  for (const func of cls.functions) {
    count += func.calls.length;
  }

  for (const nested of cls.nestedClasses) {
    count += countCallsInClass(nested);
  }

  if (cls.companionObject) {
    for (const func of cls.companionObject.functions) {
      count += func.calls.length;
    }
  }

  return count;
}

/**
 * Lookup a symbol by FQN.
 */
export function lookupSymbol(table: SymbolTable, fqn: string): Symbol | undefined {
  return table.byFqn.get(fqn);
}

/**
 * Find all symbols matching a pattern (simple glob-like matching).
 */
export function findSymbols(table: SymbolTable, pattern: string): Symbol[] {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  const results: Symbol[] = [];

  for (const symbol of table.byFqn.values()) {
    if (regex.test(symbol.fqn) || regex.test(symbol.name)) {
      results.push(symbol);
    }
  }

  return results;
}
