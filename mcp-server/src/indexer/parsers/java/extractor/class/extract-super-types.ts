/**
 * Super type extraction for Java parsing.
 *
 * Extracts extends and implements clauses from class and interface declarations.
 */

import type { SyntaxNode } from 'tree-sitter';
import { findChildByType, extractFullTypeName } from '../ast-utils/index.js';

/**
 * Result of extracting super types from a class or interface declaration.
 */
export interface SuperTypesResult {
  superClass?: string;
  interfaces: string[];
}

/**
 * Extract super types (superclass and interfaces) from a Java declaration.
 *
 * Java rules:
 * - Class: can extend one class and implement multiple interfaces
 *   Example: class Foo extends Bar implements Baz, Qux {}
 *
 * - Interface: can extend multiple interfaces (no implements)
 *   Example: interface Foo extends Bar, Baz {}
 *
 * - Enum: can implement interfaces (implicit extends Enum<>)
 *   Example: enum Status implements Serializable {}
 *
 * - Record: can implement interfaces (implicit extends Record)
 *   Example: record Point(int x, int y) implements Serializable {}
 *
 * @param node - The class, interface, enum, or record declaration node
 * @returns SuperTypesResult with superClass and interfaces arrays
 */
export function extractSuperTypes(node: SyntaxNode): SuperTypesResult {
  let superClass: string | undefined;
  const interfaces: string[] = [];

  // Handle extends clause (superclass for class, superinterfaces for interface)
  const superclassNode = findChildByType(node, 'superclass');
  if (superclassNode) {
    // superclass > type_identifier | generic_type
    for (const child of superclassNode.children) {
      if (child.type === 'extends') continue;
      // Use full type name to preserve generics
      if (child.type === 'type_identifier' || child.type === 'generic_type' || child.type === 'scoped_type_identifier') {
        superClass = extractFullTypeName(child);
        break; // Java only allows one superclass
      }
    }
  }

  // For interfaces: extends_interfaces (multiple interfaces)
  const extendsInterfaces = findChildByType(node, 'extends_interfaces');
  if (extendsInterfaces) {
    // extends_interfaces > extends type_list
    const typeList = findChildByType(extendsInterfaces, 'type_list');
    if (typeList) {
      for (const child of typeList.children) {
        if (child.type === ',' || child.type === 'extends') continue;
        if (child.type === 'type_identifier' || child.type === 'generic_type' || child.type === 'scoped_type_identifier') {
          interfaces.push(extractFullTypeName(child));
        }
      }
    }
  }

  // Handle implements clause (interfaces for class/enum/record)
  const superInterfaces = findChildByType(node, 'super_interfaces');
  if (superInterfaces) {
    // super_interfaces > implements type_list
    const typeList = findChildByType(superInterfaces, 'type_list');
    if (typeList) {
      for (const child of typeList.children) {
        if (child.type === ',' || child.type === 'implements') continue;
        if (child.type === 'type_identifier' || child.type === 'generic_type' || child.type === 'scoped_type_identifier') {
          interfaces.push(extractFullTypeName(child));
        }
      }
    }
  }

  return { superClass, interfaces };
}
