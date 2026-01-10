/**
 * Class kind mapping for TypeScript parsing.
 *
 * Maps TypeScript AST node types to ParsedClass.kind values.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';

type ClassKind = ParsedClass['kind'];

/**
 * Map a TypeScript AST node type to a ParsedClass kind.
 *
 * | Node type                | Kind          | Notes                    |
 * |-------------------------|---------------|--------------------------|
 * | class_declaration       | 'class'       |                          |
 * | abstract_class_decl... | 'class'       | isAbstract: true         |
 * | interface_declaration   | 'interface'   |                          |
 * | enum_declaration        | 'enum'        |                          |
 *
 * Note: TypeScript doesn't have:
 * - annotation classes (@interface in Java)
 * - object declarations (object in Kotlin)
 * - sealed classes (as a separate declaration type)
 * - data classes (record in Java)
 *
 * @param node - The AST node representing a type declaration
 * @returns The corresponding ParsedClass kind
 */
export function mapClassKind(node: SyntaxNode): ClassKind {
  switch (node.type) {
    case 'interface_declaration':
      return 'interface';

    case 'enum_declaration':
      return 'enum';

    case 'class_declaration':
    case 'abstract_class_declaration':
    default:
      return 'class';
  }
}

/**
 * Check if a node represents an abstract class.
 *
 * In tree-sitter-typescript, abstract classes can be:
 * - A class_declaration with 'abstract' child modifier
 * - Or an abstract_class_declaration node type (depending on grammar version)
 *
 * @param node - The AST node to check
 * @returns true if this is an abstract class
 */
export function isAbstractClass(node: SyntaxNode): boolean {
  if (node.type === 'abstract_class_declaration') {
    return true;
  }

  if (node.type === 'class_declaration') {
    return node.children.some((c) => c.type === 'abstract');
  }

  return false;
}
