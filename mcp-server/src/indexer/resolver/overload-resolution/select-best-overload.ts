/**
 * Select the best overload from candidates based on argument information.
 */

import type { ParsedCall } from '../../types.js';
import type { FunctionSymbol } from '../types.js';
import { scoreOverloadMatch } from './score-overload-match.js';

/**
 * Select the best overload from candidates based on argument information.
 * Uses a scoring system to find the most specific match.
 */
export function selectBestOverload(candidates: FunctionSymbol[], call?: ParsedCall): FunctionSymbol | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  if (!call) return candidates[0]; // No call info, return first candidate

  const argCount = call.argumentCount ?? 0;
  const argTypes = call.argumentTypes || [];

  // Score each candidate
  const scored = candidates.map((candidate) => ({
    func: candidate,
    score: scoreOverloadMatch(candidate, argCount, argTypes),
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Return best match if it has a positive score
  const best = scored[0];
  if (best && best.score > 0) {
    return best.func;
  }

  // If no good match based on types, try argument count match
  const countMatches = candidates.filter((c) => c.parameterTypes.length === argCount);
  if (countMatches.length === 1 && countMatches[0]) {
    return countMatches[0];
  }

  // Fallback to first candidate
  return candidates[0];
}
