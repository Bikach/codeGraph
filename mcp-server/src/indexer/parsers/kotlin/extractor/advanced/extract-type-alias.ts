/**
 * Type alias extraction for Kotlin parsing.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeAlias } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';

/**
 * Extract a type alias from a typealias_declaration node.
 *
 * Type aliases provide alternative names for existing types:
 * typealias StringList = List<String>
 * typealias Predicate<T> = (T) -> Boolean
 */
export function extractTypeAlias(node: SyntaxNode): ParsedTypeAlias {
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<unnamed>';

  const modifiers = extractModifiers(node);

  // Extract type parameters if present
  const typeParameters = extractTypeParameters(node);

  // Extract the aliased type (after '=')
  let aliasedType = '';
  for (const child of node.children) {
    if (
      child.type === 'user_type' ||
      child.type === 'nullable_type' ||
      child.type === 'function_type'
    ) {
      // Check if preceded by '='
      const prev = child.previousSibling;
      if (prev?.type === '=') {
        aliasedType = child.text;
        break;
      }
    }
  }

  return {
    name,
    aliasedType,
    visibility: modifiers.visibility,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    location: nodeLocation(node),
  };
}
