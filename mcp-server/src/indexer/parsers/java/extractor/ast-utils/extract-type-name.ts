/**
 * Extract type name from Java AST node.
 *
 * Handles Java-specific type nodes:
 * - type_identifier: Simple type (e.g., "String")
 * - generic_type: Parameterized type (e.g., "List<String>")
 * - array_type: Array type (e.g., "int[]")
 * - scoped_type_identifier: Qualified type (e.g., "java.util.List")
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from './find-child-by-type.js';

/**
 * Extract the type name from a Java type node.
 * Returns the simple name without generics for resolution purposes.
 */
export function extractTypeName(typeNode: SyntaxNode): string | undefined {
  switch (typeNode.type) {
    case 'type_identifier':
      return typeNode.text;

    case 'generic_type': {
      // Get the base type (e.g., "List" from "List<String>")
      const baseType = findChildByType(typeNode, 'type_identifier');
      return baseType?.text ?? typeNode.text;
    }

    case 'array_type': {
      // Get the element type (e.g., "int" from "int[]")
      const elementType = typeNode.children[0];
      return elementType ? extractTypeName(elementType) : typeNode.text;
    }

    case 'scoped_type_identifier': {
      // Get the rightmost identifier (e.g., "List" from "java.util.List")
      const identifier = findChildByType(typeNode, 'type_identifier');
      return identifier?.text ?? typeNode.text;
    }

    case 'integral_type':
    case 'floating_point_type':
    case 'boolean_type':
    case 'void_type':
      return typeNode.text;

    default:
      return typeNode.text;
  }
}

/**
 * Extract the full type representation including generics and arrays.
 */
export function extractFullTypeName(typeNode: SyntaxNode): string {
  return typeNode.text;
}
