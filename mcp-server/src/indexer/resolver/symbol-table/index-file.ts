/**
 * Index all symbols from a single file into the symbol table.
 */

import type { ParsedFile } from '../../types.js';
import type { PropertySymbol, TypeAliasSymbol, SymbolTable } from '../types.js';
import { addSymbol } from './add-symbol.js';
import { indexClass } from './index-class.js';
import { indexFunction } from './index-function.js';

/**
 * Index all symbols from a single file into the symbol table.
 */
export function indexFile(table: SymbolTable, file: ParsedFile): void {
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
