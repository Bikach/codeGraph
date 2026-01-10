/**
 * Extract type aliases from TypeScript type_alias_declaration nodes.
 *
 * TypeScript type aliases:
 * - type UserId = string
 * - type User = { name: string; age: number }
 * - type Result<T> = T | Error
 * - type Handler<T, R> = (input: T) => R
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeAlias } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractTypeParameters } from '../generics/index.js';

/**
 * Extract a type alias from a type_alias_declaration node.
 *
 * TypeScript AST structure:
 * type_alias_declaration >
 *   [export] type type_identifier [type_parameters] = type
 *
 * Examples:
 * - type UserId = string
 * - type User = { name: string }
 * - type Result<T> = T | Error
 * - type Handler<T, R extends object> = (input: T) => R
 */
export function extractTypeAlias(node: SyntaxNode): ParsedTypeAlias {
  // Extract the type name
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract type parameters if present (e.g., <T>, <K, V>, <T extends Foo>)
  const typeParameters = extractTypeParameters(node);

  // Extract the aliased type (everything after the '=')
  let aliasedType: string | undefined;
  let foundEquals = false;

  for (const child of node.children) {
    if (foundEquals) {
      // The next node after '=' is the type
      aliasedType = child.text;
      break;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }

  return {
    name,
    aliasedType: aliasedType ?? '',
    visibility: 'public', // TypeScript type aliases are always public (module-level visibility)
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    location: nodeLocation(node),
  };
}
