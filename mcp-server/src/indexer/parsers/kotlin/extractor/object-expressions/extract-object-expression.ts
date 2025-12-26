/**
 * Extract a single object expression (anonymous object).
 *
 * Object expressions in Kotlin are anonymous classes that can implement interfaces
 * or extend classes: `object : Interface { ... }`
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedObjectExpression } from '../../../../types.js';
import type { ClassBodyExtractor } from './types.js';
import { findChildByType, nodeLocation, extractTypeName } from '../ast-utils/index.js';

/**
 * Extract an object expression from an object_literal node.
 *
 * @param node - The object_literal AST node
 * @param extractClassBody - Function to extract class body members (passed to avoid circular dependency)
 * @returns ParsedObjectExpression or undefined if extraction fails
 */
export function extractObjectExpression(
  node: SyntaxNode,
  extractClassBody: ClassBodyExtractor
): ParsedObjectExpression | undefined {
  // object_literal: object [: delegation_specifiers] { class_body }
  const superTypes: string[] = [];

  // Extract implemented interfaces/extended classes
  for (const child of node.children) {
    if (child.type === 'delegation_specifier') {
      const typeRef =
        findChildByType(child, 'user_type') ?? findChildByType(child, 'constructor_invocation');
      if (typeRef) {
        const typeName = extractTypeName(typeRef);
        if (typeName) {
          superTypes.push(typeName);
        }
      }
    }
  }

  const classBody = findChildByType(node, 'class_body');
  const { properties, functions } = extractClassBody(classBody);

  return {
    superTypes,
    properties,
    functions,
    location: nodeLocation(node),
  };
}
