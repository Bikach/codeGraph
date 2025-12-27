/**
 * Score how well a function signature matches the call arguments.
 */

import type { FunctionSymbol } from '../types.js';
import { normalizeType } from './normalize-type.js';
import { isTypeCompatible } from './is-type-compatible.js';

/**
 * Score how well a function signature matches the call arguments.
 * Higher score = better match.
 */
export function scoreOverloadMatch(func: FunctionSymbol, argCount: number, argTypes: string[]): number {
  let score = 0;

  // Exact argument count match is important
  if (func.parameterTypes.length === argCount) {
    score += 100;
  } else if (argCount > func.parameterTypes.length) {
    // Too many arguments - not a match
    return -1;
  }
  // Note: Fewer args might be OK due to default parameters, but we penalize it slightly
  else {
    score += 50; // Partial match (default params might fill the rest)
  }

  // Score type matches
  for (let i = 0; i < argTypes.length && i < func.parameterTypes.length; i++) {
    const argType = argTypes[i];
    const paramType = func.parameterTypes[i];

    if (!argType || argType === 'Unknown' || !paramType) {
      // Unknown type - neutral score
      continue;
    }

    // Strip generics and nullability for comparison
    const normalizedArg = normalizeType(argType);
    const normalizedParam = normalizeType(paramType);

    if (normalizedArg === normalizedParam) {
      // Exact type match
      score += 50;
    } else if (isTypeCompatible(normalizedArg, normalizedParam)) {
      // Compatible type (e.g., Int is compatible with Number)
      score += 25;
    } else {
      // Type mismatch
      score -= 10;
    }
  }

  return score;
}
