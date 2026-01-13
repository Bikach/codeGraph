/**
 * Function call extraction for TypeScript parsing.
 *
 * Traverses a function body and extracts all function calls.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractCallExpression } from './extract-call-expression.js';
import { extractNewExpression } from './extract-new-expression.js';

/**
 * Extract all function calls from a function body.
 *
 * Traverses the AST and collects all call_expression and new_expression nodes,
 * extracting their details (name, receiver, arguments, etc.).
 */
export function extractCalls(body: SyntaxNode): ParsedCall[] {
  const calls: ParsedCall[] = [];

  traverseNode(body, (node) => {
    if (node.type === 'call_expression') {
      const call = extractCallExpression(node);
      if (call) {
        calls.push(call);
      }
    } else if (node.type === 'new_expression') {
      const call = extractNewExpression(node);
      if (call) {
        calls.push(call);
      }
    }
  });

  return calls;
}
