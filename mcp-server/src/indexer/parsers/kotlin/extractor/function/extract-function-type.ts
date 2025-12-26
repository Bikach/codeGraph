/**
 * Extract function type from Kotlin AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunctionType } from '../../../../types.js';

/**
 * Extracts a function type from a function_type AST node.
 * Handles: (Int, String) -> Boolean, Int.(String) -> Boolean, suspend () -> Unit
 */
export function extractFunctionType(
  node: SyntaxNode,
  parentNode?: SyntaxNode
): ParsedFunctionType | undefined {
  if (node.type !== 'function_type') return undefined;

  const parameterTypes: string[] = [];
  let returnType = 'Unit';
  let receiverType: string | undefined;

  // Check for suspend modifier in preceding type_modifiers sibling
  let isSuspend = false;
  if (parentNode) {
    for (const child of parentNode.children) {
      if (child.type === 'type_modifiers') {
        for (const mod of child.children) {
          if (mod.text === 'suspend') {
            isSuspend = true;
            break;
          }
        }
      }
    }
  }

  // Process function_type children
  // Pattern 1: function_type_parameters -> -> return_type
  // Pattern 2: receiver_type . function_type_parameters -> -> return_type
  let foundArrow = false;

  for (const child of node.children) {
    if (child.type === 'type_identifier' && !foundArrow) {
      // This could be the receiver type (before the dot)
      const nextSibling = child.nextSibling;
      if (nextSibling?.type === '.') {
        receiverType = child.text;
      }
    } else if (child.type === 'function_type_parameters') {
      // Extract parameter types from function_type_parameters
      for (const paramChild of child.children) {
        if (
          paramChild.type === 'user_type' ||
          paramChild.type === 'nullable_type' ||
          paramChild.type === 'function_type'
        ) {
          parameterTypes.push(paramChild.text);
        }
      }
    } else if (child.type === '->') {
      foundArrow = true;
    } else if (
      foundArrow &&
      (child.type === 'user_type' ||
        child.type === 'nullable_type' ||
        child.type === 'type_identifier')
    ) {
      // Return type comes after ->
      returnType = child.text;
    }
  }

  return {
    parameterTypes,
    returnType,
    isSuspend,
    receiverType,
  };
}
