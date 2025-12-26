/**
 * Primary constructor property extraction for Kotlin parsing.
 *
 * Extracts properties declared in the primary constructor
 * (parameters with val/var modifiers).
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';

/**
 * Extract properties from a class's primary constructor.
 *
 * In Kotlin, constructor parameters with `val` or `var` become class properties.
 * Example: class User(val name: String, var age: Int)
 */
export function extractPrimaryConstructorProperties(classNode: SyntaxNode): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Primary constructor is in primary_constructor node
  const primaryConstructor = findChildByType(classNode, 'primary_constructor');
  if (!primaryConstructor) return properties;

  // class_parameter nodes are direct children of primary_constructor (not in class_parameters)
  for (const child of primaryConstructor.children) {
    if (child.type === 'class_parameter') {
      // Check if it's a property (has val/var in binding_pattern_kind)
      const bindingKind = findChildByType(child, 'binding_pattern_kind');
      const hasVal = bindingKind?.children.some((c) => c.type === 'val') ?? false;
      const hasVar = bindingKind?.children.some((c) => c.type === 'var') ?? false;

      if (hasVal || hasVar) {
        const nameNode = findChildByType(child, 'simple_identifier');
        const typeNode =
          findChildByType(child, 'nullable_type') ??
          findChildByType(child, 'user_type') ??
          findChildByType(child, 'type_identifier');

        // Extract visibility from modifiers if present
        const modifiers = extractModifiers(child);

        properties.push({
          name: nameNode?.text ?? '<unnamed>',
          type: typeNode?.text,
          visibility: modifiers.visibility,
          isVal: hasVal,
          initializer: undefined, // Primary constructor props don't have initializers in declaration
          annotations: extractAnnotations(child),
          location: nodeLocation(child),
        });
      }
    }
  }

  return properties;
}
