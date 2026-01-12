/**
 * Extract type aliases from TypeScript type_alias_declaration nodes.
 *
 * TypeScript type aliases:
 * - type UserId = string
 * - type User = { name: string; age: number }
 * - type Result<T> = T | Error
 * - type Handler<T, R> = (input: T) => R
 * - type Readonly<T> = { readonly [K in keyof T]: T[K] } (mapped type)
 * - type IsArray<T> = T extends any[] ? true : false (conditional)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeAlias } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractMappedType, isMappedType } from './extract-mapped-type.js';
import {
  extractConditionalType,
  findConditionalTypeNode,
} from './extract-conditional-type.js';

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
 * - type Readonly<T> = { readonly [K in keyof T]: T[K] } (mapped type)
 * - type IsArray<T> = T extends any[] ? true : false (conditional)
 */
export function extractTypeAlias(node: SyntaxNode): ParsedTypeAlias {
  // Extract the type name
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract type parameters if present (e.g., <T>, <K, V>, <T extends Foo>)
  const typeParameters = extractTypeParameters(node);

  // Extract the aliased type (everything after the '=')
  let aliasedType: string | undefined;
  let aliasedTypeNode: SyntaxNode | undefined;
  let foundEquals = false;

  for (const child of node.children) {
    if (foundEquals) {
      // The next node after '=' is the type
      aliasedType = child.text;
      aliasedTypeNode = child;
      break;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }

  // Check if this is a mapped type and extract structured information
  const mappedType =
    aliasedTypeNode && isMappedType(aliasedTypeNode)
      ? extractMappedType(aliasedTypeNode)
      : undefined;

  // Check if the aliased type is a conditional type and extract its structure
  let conditionalType;
  if (aliasedTypeNode) {
    const conditionalNode = findConditionalTypeNode(aliasedTypeNode);
    if (conditionalNode) {
      conditionalType = extractConditionalType(conditionalNode);
    }
  }

  return {
    name,
    aliasedType: aliasedType ?? '',
    visibility: 'public', // TypeScript type aliases are always public (module-level visibility)
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    mappedType,
    conditionalType,
    location: nodeLocation(node),
  };
}
