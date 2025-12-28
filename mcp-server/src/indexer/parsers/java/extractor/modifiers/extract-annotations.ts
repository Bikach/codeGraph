/**
 * Extract annotations from a Java declaration node.
 *
 * Java AST structure:
 * - modifiers
 *   - marker_annotation: @Override (no arguments)
 *   - annotation: @Deprecated(since = "1.0") (with arguments)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedAnnotation } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractAnnotationArguments } from './extract-annotation-arguments.js';

/**
 * Extract all annotations from a Java declaration node.
 * Annotations are found in the modifiers node.
 */
export function extractAnnotations(node: SyntaxNode): ParsedAnnotation[] {
  const annotations: ParsedAnnotation[] = [];
  const modifiersNode = findChildByType(node, 'modifiers');

  if (!modifiersNode) return annotations;

  for (const child of modifiersNode.children) {
    if (child.type === 'marker_annotation' || child.type === 'annotation') {
      const nameNode = findChildByType(child, 'identifier') ?? findChildByType(child, 'scoped_identifier');

      if (nameNode) {
        annotations.push({
          name: extractAnnotationName(nameNode),
          arguments: extractAnnotationArguments(child),
        });
      }
    }
  }

  return annotations;
}

/**
 * Extract the simple annotation name from an identifier node.
 * For scoped identifiers like @javax.annotation.Nullable, returns "Nullable".
 */
function extractAnnotationName(node: SyntaxNode): string {
  if (node.type === 'scoped_identifier') {
    // Get the last identifier in the chain
    const identifiers = node.children.filter((c) => c.type === 'identifier');
    return identifiers[identifiers.length - 1]?.text ?? node.text;
  }
  return node.text;
}
