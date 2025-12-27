/**
 * Count all calls in a class (including nested classes and companion).
 */

import type { ParsedClass } from '../../types.js';

/**
 * Count all calls in a class (including nested classes and companion).
 */
export function countCallsInClass(cls: ParsedClass): number {
  let count = 0;

  for (const func of cls.functions) {
    count += func.calls.length;
  }

  for (const nested of cls.nestedClasses) {
    count += countCallsInClass(nested);
  }

  if (cls.companionObject) {
    for (const func of cls.companionObject.functions) {
      count += func.calls.length;
    }
  }

  return count;
}
