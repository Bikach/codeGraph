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

/**
 * Find the first node of a given type in the tree.
 */
export function findNodeByType(root: SyntaxNode, type: string): SyntaxNode | undefined {
  let result: SyntaxNode | undefined;
  traverseNode(root, (node) => {
    if (node.type === type && !result) {
      result = node;
    }
  });
  return result;
}
