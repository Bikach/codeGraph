/**
 * Extract type parameters (generics) from a class or function declaration.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSingleTypeParameter } from './extract-single-type-parameter.js';

/**
 * Extracts all type parameters from a class or function declaration.
 * Also processes where clauses for additional type bounds.
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

  // Handle where clause (multiple type bounds)
  // AST: type_constraints > where, type_constraint, [,], type_constraint, ...
  const typeConstraints = findChildByType(node, 'type_constraints');
  if (typeConstraints) {
    for (const constraintNode of typeConstraints.children) {
      if (constraintNode.type === 'type_constraint') {
        // type_constraint > type_identifier, :, user_type
        const typeId = findChildByType(constraintNode, 'type_identifier');
        const boundType =
          findChildByType(constraintNode, 'user_type') ??
          findChildByType(constraintNode, 'nullable_type');

        if (typeId && boundType) {
          // Find the matching type parameter and add this bound
          const matchingParam = typeParams.find((tp) => tp.name === typeId.text);
          if (matchingParam) {
            if (!matchingParam.bounds) {
              matchingParam.bounds = [];
            }
            matchingParam.bounds.push(boundType.text);
          }
        }
      }
    }
  }

  return typeParams;
}
