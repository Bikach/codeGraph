/**
 * Extract a single type parameter from a type_parameter AST node.
 *
 * Java type parameters: T, T extends Foo, T extends Foo & Bar
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType, extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extracts a single type parameter from a type_parameter node.
 *
 * Java AST structure:
 * - type_parameter > type_identifier [extends type_bound]
 * - type_bound > type_identifier [& type_identifier]*
 *
 * Examples:
 * - T -> { name: 'T' }
 * - T extends Number -> { name: 'T', bounds: ['Number'] }
 * - T extends Comparable<T> -> { name: 'T', bounds: ['Comparable<T>'] }
 * - T extends Number & Serializable -> { name: 'T', bounds: ['Number', 'Serializable'] }
 */
export function extractSingleTypeParameter(node: SyntaxNode): ParsedTypeParameter | undefined {
  // Find the type identifier (parameter name)
  const nameNode = findChildByType(node, 'type_identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;
  const bounds: string[] = [];

  // Check for type_bound (extends clause)
  const typeBound = findChildByType(node, 'type_bound');
  if (typeBound) {
    // type_bound can contain multiple types separated by &
    // Each bound type can be: type_identifier, generic_type, or other type nodes
    for (const child of typeBound.children) {
      if (child.type === '&' || child.type === 'extends') continue;

      // Use full type name to preserve generics (e.g., Comparable<T>)
      if (child.type === 'type_identifier' || child.type === 'generic_type' || child.type === 'scoped_type_identifier') {
        bounds.push(extractFullTypeName(child));
      }
    }
  }

  return {
    name,
    bounds: bounds.length > 0 ? bounds : undefined,
    // Java doesn't have variance or reified type parameters
    variance: undefined,
    isReified: undefined,
  };
}
