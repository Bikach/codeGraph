/**
 * Extract type name from TypeScript AST node.
 *
 * Handles TypeScript-specific type nodes:
 * - type_identifier: User-defined type (e.g., "User")
 * - predefined_type: Built-in type (e.g., "string", "number")
 * - generic_type: Parameterized type (e.g., "Array<string>")
 * - nested_type_identifier: Qualified type (e.g., "React.FC")
 * - union_type: Union type (e.g., "string | number")
 * - intersection_type: Intersection type (e.g., "A & B")
 * - array_type: Array type (e.g., "string[]")
 * - type_annotation: Type annotation with colon (e.g., ": string")
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from './find-child-by-type.js';

/**
 * Extract the type name from a TypeScript type node.
 * Returns the simple name without generics for resolution purposes.
 */
export function extractTypeName(node: SyntaxNode | undefined): string | undefined {
  if (!node) return undefined;

  switch (node.type) {
    case 'type_annotation': {
      // Skip the ':' and get the actual type, then recursively extract
      const typeChild = node.children.find((c) => c.type !== ':');
      return typeChild ? extractTypeName(typeChild) : undefined;
    }

    case 'type_identifier':
    case 'identifier':
    case 'predefined_type':
      return node.text;

    case 'generic_type': {
      // Get the base type (e.g., "Array" from "Array<string>")
      const baseType = findChildByType(node, 'type_identifier');
      return baseType?.text ?? node.text;
    }

    case 'nested_type_identifier': {
      // Get the full qualified name (e.g., "React.FC")
      return node.text;
    }

    case 'array_type': {
      // Get the element type (e.g., "string" from "string[]")
      const elementType = node.children[0];
      return elementType ? extractTypeName(elementType) : node.text;
    }

    case 'union_type':
    case 'intersection_type':
    case 'parenthesized_type':
    case 'literal_type':
    case 'function_type':
    case 'tuple_type':
      // For complex types, return the full text
      return node.text;

    default:
      return node.text;
  }
}

/**
 * Extract the full type representation including generics and arrays.
 */
export function extractFullTypeName(node: SyntaxNode | undefined): string | undefined {
  if (!node) return undefined;

  if (node.type === 'type_annotation') {
    // Skip the ':' and get the actual type
    const typeChild = node.children.find((c) => c.type !== ':');
    return typeChild?.text;
  }

  return node.text;
}

/**
 * Extract the inner type from a type_annotation node (without the colon).
 */
export function extractTypeNode(typeAnnotation: SyntaxNode | undefined): SyntaxNode | undefined {
  if (!typeAnnotation) return undefined;

  if (typeAnnotation.type === 'type_annotation') {
    return typeAnnotation.children.find((c) => c.type !== ':');
  }

  return typeAnnotation;
}
