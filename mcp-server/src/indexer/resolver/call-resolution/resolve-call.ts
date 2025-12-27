/**
 * Resolve a single call to its target FQN.
 * Returns undefined if the call cannot be resolved.
 * Supports overload resolution using argument types from the call.
 */

import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedCall } from '../../types.js';
import { getStdlibProvider } from '../stdlib/stdlib-registry.js';
import { getClassFqn } from '../utils/index.js';
import {
  selectBestOverload,
  findMethodsInType,
  findFunctionsInPackage,
} from '../overload-resolution/index.js';
import { resolveQualifiedCall } from './resolve-qualified-call.js';
import { resolveConstructorCall } from './resolve-constructor-call.js';
import { resolveMethodInType } from './resolve-method-in-type.js';
import { resolveMethodInHierarchy } from './resolve-method-in-hierarchy.js';
import { resolveSymbolByName } from './resolve-symbol-by-name.js';
import { resolveExtensionFunction } from './resolve-extension-function.js';
import { resolveEnumStaticMethod } from './resolve-enum-static-method.js';

/**
 * Resolve a single call to its target FQN.
 * Returns undefined if the call cannot be resolved.
 * Supports overload resolution using argument types from the call.
 *
 * Resolution strategy (by priority):
 * 0. Qualified call (receiver is already an FQN)
 * 0.5. Constructor call (no receiver, name matches a class)
 * 1. Explicit receiver type
 * 2. Receiver expression (local variable, class property, static call)
 * 3. Current class methods
 * 4. Imported symbols
 * 5. Same package
 * 6. Wildcard imports
 * 7. Extension functions
 * 8. Top-level functions
 * 9. Stdlib functions
 * 10. Stdlib static methods
 *
 * @param table - The symbol table to search in
 * @param context - The resolution context
 * @param call - The call to resolve
 * @returns The resolved FQN, or undefined if not resolved
 */
export function resolveCall(
  table: SymbolTable,
  context: ResolutionContext,
  call: ParsedCall
): string | undefined {
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
