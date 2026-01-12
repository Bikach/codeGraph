/**
 * Arrow function extraction for TypeScript parsing.
 *
 * Extracts arrow functions from variable declarations.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction, ParsedParameter } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractCalls } from '../calls/index.js';
import { extractParameters } from './extract-parameters.js';
import { extractArrowReturnType } from './extract-return-type.js';

/**
 * Extract an arrow function from a variable_declarator.
 *
 * const foo = () => {}
 *       ↑ name        ↑ arrow_function
 *
 * Arrow function structure:
 * arrow_function > async?, type_parameters?, formal_parameters | identifier, =>, type_annotation?, statement_block | expression
 */
export function extractArrowFunction(declarator: SyntaxNode, arrowFunc: SyntaxNode): ParsedFunction {
  // Name from the declarator
  const nameNode = findChildByType(declarator, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Check async
  const isAsync = arrowFunc.children.some((c) => c.type === 'async');

  // Type parameters
  const typeParameters = extractTypeParameters(arrowFunc);

  // Parameters - can be single identifier or formal_parameters
  const paramsNode = findChildByType(arrowFunc, 'formal_parameters');
  let parameters: ParsedParameter[];

  if (paramsNode) {
    parameters = extractParameters(paramsNode);
  } else {
    // Single parameter without parens: x => x + 1
    const singleParam = arrowFunc.children.find((c) => c.type === 'identifier' && c.nextSibling?.type === '=>');
    if (singleParam) {
      parameters = [
        {
          name: singleParam.text,
          type: undefined,
          defaultValue: undefined,
          annotations: [],
        },
      ];
    } else {
      parameters = [];
    }
  }

  // Return type (type_annotation after params but before =>)
  const returnType = extractArrowReturnType(arrowFunc);

  // Body calls - can be statement_block or expression
  const body =
    findChildByType(arrowFunc, 'statement_block') ??
    arrowFunc.children.find(
      (c) =>
        c.type !== 'formal_parameters' &&
        c.type !== '=>' &&
        c.type !== 'type_annotation' &&
        c.type !== 'type_parameters' &&
        c.type !== 'async' &&
        c.type !== 'identifier',
    );
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: 'public', // Variables don't have visibility modifiers
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    receiverType: undefined,
    isInline: undefined,
    isInfix: undefined,
    isOperator: undefined,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: [],
    location: nodeLocation(arrowFunc),
    calls,
  };
}

/**
 * Check if a variable declarator contains an arrow function.
 */
export function isArrowFunctionDeclarator(declarator: SyntaxNode): boolean {
  return !!findChildByType(declarator, 'arrow_function');
}

/**
 * Get the arrow function node from a variable declarator.
 */
export function getArrowFunction(declarator: SyntaxNode): SyntaxNode | undefined {
  return findChildByType(declarator, 'arrow_function');
}
