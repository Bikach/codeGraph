/**
 * Traverse AST nodes recursively.
 */
import type { SyntaxNode } from 'tree-sitter';

/**
 * Traverse all descendant nodes and call the visitor for each.
 * Visitor can return false to skip visiting children of the current node.
 *
 * @param node - The root node to traverse
 * @param visitor - Function called for each node. Return false to skip children.
 */
export function traverseNode(node: SyntaxNode, visitor: (node: SyntaxNode) => boolean | void): void {
  const shouldContinue = visitor(node);
  if (shouldContinue === false) return;

  for (const child of node.children) {
    traverseNode(child, visitor);
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
      return false; // Stop traversal
    }
    return undefined;
  });
  return result;
}

/**
 * Find all descendant nodes matching a predicate.
 *
 * @param node - The root node to search
 * @param predicate - Function to test each node
 * @returns Array of matching nodes
 */
export function findAllNodes(node: SyntaxNode, predicate: (node: SyntaxNode) => boolean): SyntaxNode[] {
  const results: SyntaxNode[] = [];

  traverseNode(node, (n) => {
    if (predicate(n)) {
      results.push(n);
    }
  });

  return results;
}

/**
 * Find the first descendant node matching a predicate.
 *
 * @param node - The root node to search
 * @param predicate - Function to test each node
 * @returns The first matching node, or undefined
 */
export function findFirstNode(node: SyntaxNode, predicate: (node: SyntaxNode) => boolean): SyntaxNode | undefined {
  let result: SyntaxNode | undefined;

  traverseNode(node, (n) => {
    if (predicate(n)) {
      result = n;
      return false; // Stop traversal
    }
    return undefined;
  });

  return result;
}
