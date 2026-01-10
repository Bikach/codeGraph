/**
 * Extract a single type parameter from a type_parameter AST node.
 *
 * TypeScript type parameters: T, T extends Foo, T extends Foo & Bar, T = DefaultType
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType, extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extracts a single type parameter from a type_parameter node.
 *
 * TypeScript AST structure:
 * - type_parameter > type_identifier [constraint] [default_type]
 * - constraint > extends type
 *
 * Examples:
 * - T -> { name: 'T' }
 * - T extends number -> { name: 'T', bounds: ['number'] }
 * - T extends Comparable<T> -> { name: 'T', bounds: ['Comparable<T>'] }
 * - T extends string = 'default' -> { name: 'T', bounds: ['string'] }
 * - in T (variance) -> { name: 'T', variance: 'in' }
 * - out T (variance) -> { name: 'T', variance: 'out' }
 */
export function extractSingleTypeParameter(node: SyntaxNode): ParsedTypeParameter | undefined {
  // Find the type identifier (parameter name)
  const nameNode = findChildByType(node, 'type_identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;
  const bounds: string[] = [];
  let variance: 'in' | 'out' | undefined;

  // Check for variance modifiers (TypeScript 4.7+)
  for (const child of node.children) {
    if (child.type === 'in') {
      variance = 'in';
    } else if (child.type === 'out') {
      variance = 'out';
    }
  }

  // Check for constraint (extends clause)
  const constraint = findChildByType(node, 'constraint');
  if (constraint) {
    // constraint > extends type
    for (const child of constraint.children) {
      if (child.type === 'extends') continue;

      // Get the full type representation
      const typeName = extractFullTypeName(child);
      if (typeName) {
        bounds.push(typeName);
      }
    }
  }

  return {
    name,
    bounds: bounds.length > 0 ? bounds : undefined,
    variance,
    isReified: undefined, // TypeScript doesn't have reified types
  };
}
