/**
 * Extract type parameters (generics) from a class, interface, or function declaration.
 *
 * TypeScript generics: <T>, <K, V>, <T extends number>, <T extends Comparable<T>>
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSingleTypeParameter } from './extract-single-type-parameter.js';

/**
 * Extracts all type parameters from a class, interface, or function declaration.
 *
 * TypeScript AST structure:
 * - type_parameters > < type_parameter [, type_parameter]* >
 *
 * Examples:
 * - class Box<T> {} -> [{ name: 'T' }]
 * - class Pair<K, V> {} -> [{ name: 'K' }, { name: 'V' }]
 * - class NumberBox<T extends number> {} -> [{ name: 'T', bounds: ['number'] }]
 * - interface Comparable<T extends Comparable<T>> -> [{ name: 'T', bounds: ['Comparable<T>'] }]
 *
 * @param node - The class, interface, or function declaration node
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

/**
 * Extract type parameters from a type_parameters node directly.
 * Use this when you already have the type_parameters node.
 *
 * @param typeParamsNode - The type_parameters AST node
 * @returns Array of parsed type parameters
 */
export function extractTypeParametersFromNode(typeParamsNode: SyntaxNode): ParsedTypeParameter[] {
  const typeParams: ParsedTypeParameter[] = [];

  for (const child of typeParamsNode.children) {
    if (child.type === 'type_parameter') {
      const typeParam = extractSingleTypeParameter(child);
      if (typeParam) {
        typeParams.push(typeParam);
      }
    }
  }

  return typeParams;
}
