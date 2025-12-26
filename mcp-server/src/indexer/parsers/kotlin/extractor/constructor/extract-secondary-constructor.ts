/**
 * Secondary constructor extraction for Kotlin parsing.
 *
 * Extracts secondary constructors with their parameters
 * and delegation calls (this/super).
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedConstructor, ParsedParameter } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';

/**
 * Extract a secondary constructor from an AST node.
 *
 * Handles:
 * - Constructor parameters
 * - Delegation to this() or super()
 * - Visibility modifiers
 * - Annotations
 */
export function extractSecondaryConstructor(node: SyntaxNode): ParsedConstructor {
  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Extract parameters
  const params: ParsedParameter[] = [];
  const paramList = findChildByType(node, 'function_value_parameters');

  if (paramList) {
    for (const child of paramList.children) {
      if (child.type === 'parameter') {
        const nameNode = findChildByType(child, 'simple_identifier');
        const typeNode =
          findChildByType(child, 'nullable_type') ??
          findChildByType(child, 'user_type') ??
          findChildByType(child, 'type');

        params.push({
          name: nameNode?.text ?? '<unnamed>',
          type: typeNode?.text,
          annotations: extractAnnotations(child),
        });
      }
    }
  }

  // Check for delegation (this() or super())
  let delegatesTo: 'this' | 'super' | undefined;
  const constructorDelegationCall = findChildByType(node, 'constructor_delegation_call');
  if (constructorDelegationCall) {
    const delegationType = constructorDelegationCall.children.find(
      (c) => c.type === 'this' || c.type === 'super'
    );
    if (delegationType?.type === 'this') delegatesTo = 'this';
    if (delegationType?.type === 'super') delegatesTo = 'super';
  }

  return {
    parameters: params,
    visibility: modifiers.visibility,
    delegatesTo,
    annotations,
    location: nodeLocation(node),
  };
}
