/**
 * Extract return type from Java method declaration.
 *
 * Java always has explicit return types (no type inference like Kotlin).
 * void is represented as undefined in ParsedFunction.returnType.
 */
import type { SyntaxNode } from 'tree-sitter';
import { extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extract the return type from a method declaration.
 *
 * Java AST structure:
 * method_declaration > type_identifier | generic_type | void_type | ...
 *
 * The return type is a direct child of method_declaration,
 * appearing before the method name.
 *
 * @param node - The method_declaration node
 * @returns The return type string, or undefined if void
 */
export function extractReturnType(node: SyntaxNode): string | undefined {
  // Find the type node (appears before the identifier)
  for (const child of node.children) {
    if (isTypeNode(child)) {
      if (child.type === 'void_type') {
        return undefined; // void methods have no return type
      }
      return extractFullTypeName(child);
    }
  }

  return undefined;
}

/**
 * Check if a node is a type node.
 */
function isTypeNode(node: SyntaxNode): boolean {
  const typeNodes = [
    'void_type',
    'type_identifier',
    'generic_type',
    'array_type',
    'scoped_type_identifier',
    'integral_type',
    'floating_point_type',
    'boolean_type',
  ];
  return typeNodes.includes(node.type);
}
