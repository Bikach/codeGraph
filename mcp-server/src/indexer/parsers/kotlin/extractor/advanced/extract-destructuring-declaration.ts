/**
 * Destructuring declaration extraction for Kotlin parsing.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedDestructuringDeclaration } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';

/**
 * Extract a destructuring declaration from a property_declaration node.
 *
 * Destructuring declarations decompose objects into multiple variables:
 * val (name, age) = person
 * val (key, value) = entry
 *
 * Returns undefined if the node is not a destructuring declaration.
 */
export function extractDestructuringDeclaration(
  node: SyntaxNode
): ParsedDestructuringDeclaration | undefined {
  // Check if this is a destructuring declaration
  // Structure: property_declaration > multi_variable_declaration > variable_declaration+
  const multiVarDecl = findChildByType(node, 'multi_variable_declaration');
  if (!multiVarDecl) return undefined;

  const componentNames: string[] = [];
  const componentTypes: (string | undefined)[] = [];

  for (const child of multiVarDecl.children) {
    if (child.type === 'variable_declaration') {
      const nameNode = findChildByType(child, 'simple_identifier');
      const typeNode =
        findChildByType(child, 'nullable_type') ??
        findChildByType(child, 'user_type');

      componentNames.push(nameNode?.text ?? '_');
      componentTypes.push(typeNode?.text);
    }
  }

  if (componentNames.length === 0) return undefined;

  const modifiers = extractModifiers(node);
  const bindingKind = findChildByType(node, 'binding_pattern_kind');
  const isVal = bindingKind
    ? bindingKind.children.some((c) => c.type === 'val')
    : node.children.some((c) => c.type === 'val');

  // Get initializer
  const initializer = node.childForFieldName('initializer');

  return {
    componentNames,
    componentTypes: componentTypes.some((t) => t !== undefined) ? componentTypes : undefined,
    initializer: initializer?.text,
    visibility: modifiers.visibility,
    isVal,
    location: nodeLocation(node),
  };
}
