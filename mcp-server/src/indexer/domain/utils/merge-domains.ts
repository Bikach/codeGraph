import type { Domain } from '../types.js';

/**
 * Merge two domain lists, avoiding duplicates.
 */
export function mergeDomains(existing: Domain[], inferred: Domain[]): Domain[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));

  for (const domain of inferred) {
    if (!existingNames.has(domain.name.toLowerCase())) {
      result.push(domain);
    }
  }

  return result;
}
