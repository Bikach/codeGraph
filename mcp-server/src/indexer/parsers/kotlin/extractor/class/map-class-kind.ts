/**
 * Class kind mapping for Kotlin parsing.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Map an AST node type to a ParsedClass kind.
 *
 * Determines if the node represents a class, interface, object, enum, or annotation.
 */
export function mapClassKind(node: SyntaxNode): ParsedClass['kind'] {
  // Check for interface/object/enum keywords as children
  const hasInterface = node.children.some((c) => c.type === 'interface');
  const hasObject = node.children.some((c) => c.type === 'object');
  const hasEnum = node.children.some((c) => c.type === 'enum');

  // Check for annotation class (modifier in modifiers > class_modifier > annotation)
  const modifiers = findChildByType(node, 'modifiers');
  const hasAnnotationModifier = modifiers?.children.some(
    (c) => c.type === 'class_modifier' && c.children.some((m) => m.type === 'annotation')
  );

  if (hasInterface) return 'interface';
  if (hasObject) return 'object';
  if (hasEnum) return 'enum';
  if (hasAnnotationModifier) return 'annotation';

  switch (node.type) {
    case 'object_declaration':
      return 'object';
    case 'enum_class_declaration':
      return 'enum';
    default:
      return 'class';
  }
}
