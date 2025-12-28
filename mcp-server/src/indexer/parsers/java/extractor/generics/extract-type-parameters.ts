/**
 * Extract type parameters (generics) from a class, interface, or method declaration.
 *
 * Java generics: <T>, <K, V>, <T extends Number>, <T extends Comparable<T>>
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSingleTypeParameter } from './extract-single-type-parameter.js';

/**
 * Extracts all type parameters from a class, interface, or method declaration.
 *
 * Java AST structure:
 * - type_parameters > < type_parameter [, type_parameter]* >
 *
 * Examples:
 * - class Box<T> {} -> [{ name: 'T' }]
 * - class Pair<K, V> {} -> [{ name: 'K' }, { name: 'V' }]
 * - class NumberBox<T extends Number> {} -> [{ name: 'T', bounds: ['Number'] }]
 * - interface Comparable<T extends Comparable<T>> -> [{ name: 'T', bounds: ['Comparable<T>'] }]
 *
 * @param node - The class, interface, or method declaration node
 * @returns Array of parsed type parameters (empty if no generics)
 */
export function extractTypeParameters(node: SyntaxNode): ParsedTypeParameter[] {
  const typeParams: ParsedTypeParameter[] = [];
  const typeParamList = findChildByType(node, 'type_parameters');

  if (!typeParamList) return typeParams;

  for (const child of typeParamList.children) {
    if (child.type === 'type_parameter') {
      const typeParam = extractSingleTypeParameter(child);
      if (typeParam) {
        typeParams.push(typeParam);
      }
    }
  }

  return typeParams;
}
