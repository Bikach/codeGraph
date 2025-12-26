/**
 * Find the first expression in a node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { isExpressionType } from './is-expression-type.js';

/**
 * Find the first expression in a node (skips named argument labels).
 * Used for extracting the value from a value_argument node.
 */
export function findFirstExpression(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    // Skip identifier and '=' for named arguments
    if (child.type === 'simple_identifier' || child.text === '=') continue;
    // Common expression types
    if (isExpressionType(child.type)) {
      return child;
    }
  }
  return undefined;
}
