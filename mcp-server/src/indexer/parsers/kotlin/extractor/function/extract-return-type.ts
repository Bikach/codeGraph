/**
 * Extract function return type from Kotlin AST.
 */
import type { SyntaxNode } from 'tree-sitter';

export function extractReturnType(node: SyntaxNode): string | undefined {
  // Return type can be: nullable_type (User?), user_type (User), or other type nodes
  // They appear after ':' and before function_body in function_declaration
  for (const child of node.children) {
    // Skip parameter types (they are inside function_value_parameters)
    if (
      child.type === 'nullable_type' ||
      child.type === 'user_type' ||
      child.type === 'type_identifier'
    ) {
      // Make sure it's not the receiver type (comes before the function name)
      const prevSibling = child.previousSibling;
      if (prevSibling?.type === ':') {
        return child.text;
      }
    }
  }
  return undefined;
}
