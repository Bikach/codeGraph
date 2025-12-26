/**
 * Function declaration extraction for Kotlin parsing.
 *
 * Extracts complete function information including parameters,
 * return type, modifiers, generics, and function calls.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractCalls } from '../calls/index.js';
import { extractParameters } from './extract-parameters.js';
import { extractReturnType } from './extract-return-type.js';
import { extractReceiverType } from './extract-receiver-type.js';

/**
 * Extract a function declaration from an AST node.
 *
 * Handles:
 * - Regular functions
 * - Extension functions
 * - Suspend functions
 * - Inline/infix/operator functions
 * - Generic functions
 */
export function extractFunction(node: SyntaxNode): ParsedFunction {
  const nameNode = node.childForFieldName('name') ?? findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);
  const parameters = extractParameters(node);
  const returnType = extractReturnType(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Check for extension function
  const receiverType = extractReceiverType(node);

  // Extract function calls from body
  const body = findChildByType(node, 'function_body');
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType,
    isAbstract: modifiers.isAbstract,
    isSuspend: modifiers.isSuspend,
    isExtension: !!receiverType,
    receiverType,
    isInline: modifiers.isInline,
    isInfix: modifiers.isInfix,
    isOperator: modifiers.isOperator,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    location: nodeLocation(node),
    calls,
  };
}
