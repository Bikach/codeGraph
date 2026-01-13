/**
 * Find the first expression in a node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { isExpressionType } from './is-expression-type.js';

/**
 * Find the first expression in a node (skips syntactic elements).
 * Used for extracting the value from an argument node.
 */
export function findFirstExpression(node: SyntaxNode): SyntaxNode | undefined {
  for (const child of node.children) {
    // Skip punctuation and syntax tokens
    if (child.type === '(' || child.type === ')' || child.type === ',' || child.type === '...') {
      continue;
    }

    // Common expression types
    if (isExpressionType(child.type)) {
      return child;
    }

    // Handle spread element - get the inner expression
    if (child.type === 'spread_element') {
      for (const spreadChild of child.children) {
        if (isExpressionType(spreadChild.type)) {
          return spreadChild;
        }
      }
    }
  }

  return undefined;
}
