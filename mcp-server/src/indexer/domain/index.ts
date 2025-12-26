/**
 * Domain Module
 *
 * Analyzes packages/modules to infer domains and calculate dependencies.
 * Works with any language that has a package/module concept.
 */

import type { ResolvedFile } from '../types.js';
import type {
  Domain,
  DomainAnalysisResult,
  DomainInferenceOptions,
} from './types.js';
import { mergeDomains } from './utils/index.js';
import { detectPrimaryLanguage, inferDomainsFromPackages } from './inference/index.js';
import { assignPackagesToConfiguredDomains } from './assignment/index.js';
import { loadDomainsConfig } from './config/index.js';
import { calculateDomainDependencies } from './dependencies/index.js';

// Re-export types
export type {
  Domain,
  DomainConfig,
  DomainsConfigFile,
  DomainAnalysisResult,
  DomainDependency,
  DomainInferenceOptions,
} from './types.js';

// =============================================================================
// Main API
// =============================================================================

/**
 * Analyze files and extract domains.
 */
export async function analyzeDomains(
  files: ResolvedFile[],
  options: DomainInferenceOptions = {}
): Promise<DomainAnalysisResult> {
  // Collect all unique packages
  const packages = new Set<string>();
  for (const file of files) {
    if (file.packageName) {
      packages.add(file.packageName);
    }
  }

  // Try to load config file first
  const configDomains = await loadDomainsConfig(options.configPath);

  let domains: Domain[];
  let unassignedPackages: string[];

  if (configDomains.length > 0) {
    // Use config file with override
    const result = assignPackagesToConfiguredDomains(Array.from(packages), configDomains);
    domains = result.domains;
    unassignedPackages = result.unassigned;

    // Infer domains for unassigned packages
    if (unassignedPackages.length > 0) {
      const language = detectPrimaryLanguage(files);
      const inferredDomains = inferDomainsFromPackages(unassignedPackages, language, options);
      domains = mergeDomains(domains, inferredDomains);
      unassignedPackages = []; // All packages now assigned
    }
  } else {
    // Pure inference mode
    const language = detectPrimaryLanguage(files);
    domains = inferDomainsFromPackages(Array.from(packages), language, options);
    unassignedPackages = [];
  }

  // Calculate dependencies between domains
  const dependencies = calculateDomainDependencies(files, domains);

  return {
    domains,
    dependencies,
    unassignedPackages,
  };
}

