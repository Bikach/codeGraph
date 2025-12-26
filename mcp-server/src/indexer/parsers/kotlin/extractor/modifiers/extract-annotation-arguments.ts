/**
 * Extract annotation arguments from an annotation node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract arguments from an annotation node.
 * Returns a record mapping argument names to their values.
 * Positional arguments are keyed as "_0", "_1", etc.
 */
export function extractAnnotationArguments(node: SyntaxNode): Record<string, string> | undefined {
  // Look for value_arguments in constructor_invocation
  const constructorInvocation = findChildByType(node, 'constructor_invocation');
  if (!constructorInvocation) return undefined;

  const valueArgs = findChildByType(constructorInvocation, 'value_arguments');
  if (!valueArgs) return undefined;

  const args: Record<string, string> = {};
  let positionalIndex = 0;

  for (const child of valueArgs.children) {
    if (child.type === 'value_argument') {
      const nameNode = findChildByType(child, 'simple_identifier');
      // Get the expression (everything after '=' or the whole argument)
      const expression = child.children.find(
        (c) =>
          c.type !== 'simple_identifier' &&
          c.type !== '=' &&
          c.type !== '(' &&
          c.type !== ')' &&
          c.type !== ','
      );

      if (nameNode) {
        // Named argument: @Deprecated(message = "use X")
        args[nameNode.text] = expression?.text ?? '';
      } else if (expression) {
        // Positional argument: @Deprecated("use X")
        args[`_${positionalIndex}`] = expression.text;
        positionalIndex++;
      }
    }
  }

  return Object.keys(args).length > 0 ? args : undefined;
}
