/**
 * Find the initializer value in AST nodes.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Find the initializer value in a variable declarator.
 * The initializer follows the = sign.
 *
 * Used for both regular variable declarations and destructuring declarations.
 *
 * @param node - The variable_declarator AST node
 * @returns The initializer node if found, undefined otherwise
 */
export function findInitializer(node: SyntaxNode): SyntaxNode | undefined {
  let foundEquals = false;
  for (const child of node.children) {
    if (foundEquals) {
      return child;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }
  return undefined;
}
