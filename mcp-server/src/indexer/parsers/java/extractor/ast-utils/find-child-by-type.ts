/**
 * Find a child node by its type.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Find the first child node with the given type.
 */
export function findChildByType(node: SyntaxNode, type: string): SyntaxNode | undefined {
  return node.children.find((c) => c.type === type);
}

/**
 * Find all child nodes with the given type.
 */
export function findChildrenByType(node: SyntaxNode, type: string): SyntaxNode[] {
  return node.children.filter((c) => c.type === type);
}
