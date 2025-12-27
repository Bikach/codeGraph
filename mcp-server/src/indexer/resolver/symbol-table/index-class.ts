/**
 * Index a class and all its members into the symbol table.
 */

import type { ParsedClass } from '../../types.js';
import type { ClassSymbol, PropertySymbol, SymbolTable } from '../types.js';
import { addSymbol } from './add-symbol.js';
import { indexFunction } from './index-function.js';

/**
 * Index a class and all its members into the symbol table.
 */
export function indexClass(
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
