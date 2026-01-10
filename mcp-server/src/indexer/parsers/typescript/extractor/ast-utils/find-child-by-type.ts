/**
 * Find child nodes by type.
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

/**
 * Find the first child node matching any of the given types.
 */
export function findChildByTypes(node: SyntaxNode, types: string[]): SyntaxNode | undefined {
  return node.children.find((c) => types.includes(c.type));
}
