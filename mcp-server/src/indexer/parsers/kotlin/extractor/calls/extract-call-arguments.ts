/**
 * Call arguments extraction for Kotlin parsing.
 *
 * Extracts argument count and types from a call_suffix node.
 * Types are inferred from literals and simple expressions where possible.
 */

import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';
import { inferArgumentType } from './type-inference/index.js';

export interface CallArgumentsResult {
  argumentCount: number;
  argumentTypes: string[];
}

/**
 * Extract argument count and types from a call_suffix node.
 * Types are inferred from literals and simple expressions where possible.
 */
export function extractCallArguments(callSuffix: SyntaxNode): CallArgumentsResult {
  const argumentTypes: string[] = [];
  let argumentCount = 0;

  // call_suffix contains value_arguments which contains value_argument nodes
  const valueArguments = findChildByType(callSuffix, 'value_arguments');
  if (!valueArguments) {
    return { argumentCount: 0, argumentTypes: [] };
  }

  for (const child of valueArguments.children) {
    if (child.type === 'value_argument') {
      argumentCount++;
      const argType = inferArgumentType(child);
      argumentTypes.push(argType);
    }
  }

  return { argumentCount, argumentTypes };
}
