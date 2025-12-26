import type { ResolvedFile } from '../../types.js';
import type { Domain, DomainDependency } from '../types.js';
import { extractPackageFromFqn } from './extract-package-from-fqn.js';

/**
 * Calculate dependencies between domains based on CALLS and USES.
 */
export function calculateDomainDependencies(files: ResolvedFile[], domains: Domain[]): DomainDependency[] {
  // Build package-to-domain lookup
  const packageToDomain = new Map<string, string>();
  for (const domain of domains) {
    for (const pkg of domain.matchedPackages) {
      packageToDomain.set(pkg, domain.name);
    }
  }

  // Count cross-domain references
  const dependencyMap = new Map<string, number>(); // "from->to" -> count

  for (const file of files) {
    const fromDomain = file.packageName ? packageToDomain.get(file.packageName) : undefined;
    if (!fromDomain) continue;

    for (const call of file.resolvedCalls) {
      // Extract package from FQN
      const toPackage = extractPackageFromFqn(call.toFqn);
      const toDomain = toPackage ? packageToDomain.get(toPackage) : undefined;

      if (toDomain && fromDomain !== toDomain) {
        const key = `${fromDomain}->${toDomain}`;
        const count = dependencyMap.get(key) || 0;
        dependencyMap.set(key, count + 1);
      }
    }
  }

  // Convert to DomainDependency array
  const dependencies: DomainDependency[] = [];
  for (const [key, weight] of dependencyMap) {
    const [from, to] = key.split('->');
    if (from && to) {
      dependencies.push({ from, to, weight });
    }
  }

  // Sort by weight descending
  return dependencies.sort((a, b) => b.weight - a.weight);
}
