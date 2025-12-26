/**
 * Extract a single type parameter from a type_parameter AST node.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeParameter } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extracts a single type parameter from a type_parameter node.
 * Handles variance (in/out), reified modifier, and type bounds.
 */
export function extractSingleTypeParameter(node: SyntaxNode): ParsedTypeParameter | undefined {
  // Structure: type_parameter > [modifiers] [type_identifier] [: type_constraint]
  const nameNode = findChildByType(node, 'type_identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;

  // Extract variance (in/out) and reified from modifiers
  let variance: 'in' | 'out' | undefined;
  let isReified = false;
  const modifiers = findChildByType(node, 'type_parameter_modifiers');
  if (modifiers) {
    for (const child of modifiers.children) {
      if (child.type === 'variance_modifier') {
        if (child.text === 'in') variance = 'in';
        if (child.text === 'out') variance = 'out';
      }
      if (child.type === 'reification_modifier' && child.text === 'reified') {
        isReified = true;
      }
    }
  }

  // Extract bounds (upper bounds after :)
  const bounds: string[] = [];
  const typeConstraint = findChildByType(node, 'type_constraint');
  if (typeConstraint) {
    // type_constraint contains the bound types
    for (const child of typeConstraint.children) {
      if (child.type === 'user_type' || child.type === 'nullable_type') {
        bounds.push(child.text);
      }
    }
  }

  // Also check for direct bounds (T : Comparable<T>)
  for (const child of node.children) {
    if (child.type === 'user_type' || child.type === 'nullable_type') {
      // Check if preceded by ':'
      const prev = child.previousSibling;
      if (prev?.type === ':') {
        bounds.push(child.text);
      }
    }
  }

  return {
    name,
    bounds: bounds.length > 0 ? bounds : undefined,
    variance,
    isReified: isReified || undefined,
  };
}
