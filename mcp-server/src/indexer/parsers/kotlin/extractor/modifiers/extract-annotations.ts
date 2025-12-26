/**
 * Extract annotations from a Kotlin declaration node.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedAnnotation } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractAnnotationArguments } from './extract-annotation-arguments.js';

/**
 * Extract all annotations from a declaration node.
 * Annotations are found in the modifiers list.
 */
export function extractAnnotations(node: SyntaxNode): ParsedAnnotation[] {
  const annotations: ParsedAnnotation[] = [];
  const modifiersList = findChildByType(node, 'modifiers');

  if (!modifiersList) return annotations;

  for (const child of modifiersList.children) {
    if (child.type === 'annotation') {
      // Annotation can be:
      // - @Name -> user_type directly
      // - @Name("arg") -> constructor_invocation > user_type
      const constructorInvocation = findChildByType(child, 'constructor_invocation');
      const nameNode = constructorInvocation
        ? findChildByType(constructorInvocation, 'user_type')
        : findChildByType(child, 'user_type') ?? findChildByType(child, 'simple_identifier');

      if (nameNode) {
        // Extract just the annotation name (e.g., "Deprecated" not "Deprecated(\"msg\")")
        const typeIdentifier = findChildByType(nameNode, 'type_identifier');
        annotations.push({
          name: typeIdentifier?.text ?? nameNode.text,
          arguments: extractAnnotationArguments(child),
        });
      }
    }
  }

  return annotations;
}
