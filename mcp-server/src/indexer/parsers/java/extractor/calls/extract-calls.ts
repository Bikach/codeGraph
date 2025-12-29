/**
 * Function call extraction for Java parsing.
 *
 * Traverses a method body and extracts all function/constructor calls.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractMethodInvocation } from './extract-method-invocation.js';
import { extractConstructorCall } from './extract-constructor-call.js';

/**
 * Extract all calls from a method/constructor body.
 *
 * Traverses the AST and collects:
 * - method_invocation: obj.method(), method(), this.method(), super.method()
 * - object_creation_expression: new Class()
 *
 * Note: explicit_constructor_invocation (this(), super() in constructors)
 * is handled separately in extract-constructor.ts as delegatesTo.
 *
 * @param body - The block AST node (method body)
 * @returns Array of ParsedCall
 */
export function extractCalls(body: SyntaxNode): ParsedCall[] {
  const calls: ParsedCall[] = [];

  traverseNode(body, (node) => {
    if (node.type === 'method_invocation') {
      const call = extractMethodInvocation(node);
      if (call) {
        calls.push(call);
      }
    } else if (node.type === 'object_creation_expression') {
      const call = extractConstructorCall(node);
      if (call) {
        calls.push(call);
      }
    }
  });

  return calls;
}
