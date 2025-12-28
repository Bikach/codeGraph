/**
 * Extract annotation arguments from a Java annotation node.
 *
 * Java AST structure:
 * - annotation / marker_annotation
 *   - annotation_argument_list (optional)
 *     - element_value_pair: name = value
 *     - element_value: single value (for value() shorthand)
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract arguments from a Java annotation node.
 * Returns a record mapping argument names to their values.
 * Single value annotations use "value" as the key.
 */
export function extractAnnotationArguments(node: SyntaxNode): Record<string, string> | undefined {
  const argList = findChildByType(node, 'annotation_argument_list');
  if (!argList) return undefined;

  const args: Record<string, string> = {};

  for (const child of argList.children) {
    if (child.type === 'element_value_pair') {
      // Named argument: @Deprecated(since = "1.0")
      const identifier = findChildByType(child, 'identifier');
      const value = findChildByType(child, 'element_value') ?? child.children[child.children.length - 1];

      if (identifier && value) {
        args[identifier.text] = value.text;
      }
    } else if (child.type === 'element_value' || child.type === 'string_literal') {
      // Single value shorthand: @SuppressWarnings("unchecked")
      args['value'] = child.text;
    }
  }

  return Object.keys(args).length > 0 ? args : undefined;
}
