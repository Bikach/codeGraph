/**
 * Traverse AST nodes recursively.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Traverse a node and all its descendants, calling the callback for each.
 */
export function traverseNode(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (const child of node.children) {
    traverseNode(child, callback);
  }
}
