import type { Domain, DomainConfig } from '../types.js';
import { matchesAnyPattern } from '../pattern-matching/index.js';

/**
 * Assign packages to configured domains based on patterns.
 */
export function assignPackagesToConfiguredDomains(
  packages: string[],
  configs: DomainConfig[]
): { domains: Domain[]; unassigned: string[] } {
  const domains: Domain[] = configs.map((config) => ({
    name: config.name,
    description: config.description,
    patterns: config.patterns,
    matchedPackages: [],
  }));

  const unassigned: string[] = [];

  for (const pkg of packages) {
    let assigned = false;

    for (const domain of domains) {
      if (matchesAnyPattern(pkg, domain.patterns)) {
        domain.matchedPackages.push(pkg);
        assigned = true;
        break; // First match wins
      }
    }

    if (!assigned) {
      unassigned.push(pkg);
    }
  }

  return { domains, unassigned };
}
