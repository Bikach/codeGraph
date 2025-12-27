/**
 * Get statistics about the resolution results.
 */

import type { ResolvedFile } from '../../types.js';
import type { ResolutionStats } from '../types.js';
import { countCallsInClass } from './count-calls-in-class.js';

/**
 * Get statistics about the resolution results.
 */
export function getResolutionStats(resolvedFiles: ResolvedFile[]): ResolutionStats {
  let totalCalls = 0;
  let resolvedCalls = 0;

  for (const file of resolvedFiles) {
    // Count total calls from all functions
    for (const func of file.topLevelFunctions) {
      totalCalls += func.calls.length;
    }
    for (const cls of file.classes) {
      totalCalls += countCallsInClass(cls);
    }

    // Count resolved calls
    resolvedCalls += file.resolvedCalls.length;
  }

  return {
    totalCalls,
    resolvedCalls,
    unresolvedCalls: totalCalls - resolvedCalls,
    resolutionRate: totalCalls > 0 ? resolvedCalls / totalCalls : 1,
  };
}
