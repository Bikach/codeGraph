/**
 * Extract all object expressions from a Kotlin AST.
 *
 * This function traverses the entire AST to find all object expressions
 * (anonymous objects) used in function bodies, assignments, etc.
 * These are tracked for dependency analysis.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedObjectExpression } from '../../../../types.js';
import type { ClassBodyExtractor } from './types.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractObjectExpression } from './extract-object-expression.js';

/**
 * Extract all object expressions from the AST.
 *
 * @param root - The root node of the Kotlin AST
 * @param extractClassBody - Function to extract class body members (passed to avoid circular dependency)
 * @returns Array of ParsedObjectExpression
 */
export function extractAllObjectExpressions(
  root: SyntaxNode,
  extractClassBody: ClassBodyExtractor
): ParsedObjectExpression[] {
  const expressions: ParsedObjectExpression[] = [];

  traverseNode(root, (node) => {
    if (node.type === 'object_literal') {
      const expr = extractObjectExpression(node, extractClassBody);
      if (expr) {
        expressions.push(expr);
      }
    }
  });

  return expressions;
}
