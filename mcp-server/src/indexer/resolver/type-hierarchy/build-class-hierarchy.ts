/**
 * Build hierarchy for a single class.
 */

import type { SymbolTable } from '../types.js';
import type { ParsedClass } from '../../types.js';
import { resolveTypeName } from './resolve-type-name.js';

/**
 * Build hierarchy for a single class (extends/implements relationships).
 *
 * Processes the class and its nested classes recursively, resolving
 * superclass and interface references to their FQNs where possible.
 *
 * @param table - The symbol table to update
 * @param cls - The parsed class to process
 * @param packageName - The package containing the class
 * @param parentFqn - Optional FQN of the parent class (for nested classes)
 */
export function buildClassHierarchy(
  table: SymbolTable,
  cls: ParsedClass,
  packageName: string,
  parentFqn?: string
): void {
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
