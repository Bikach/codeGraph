import { matchesPattern } from './matches-pattern.js';

/**
 * Check if a package matches any of the patterns.
 * Supports glob-style patterns with * and **.
 */
export function matchesAnyPattern(pkg: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(pkg, pattern)) {
      return true;
    }
  }
  return false;
}
