/**
 * Domain Module
 *
 * Analyzes packages/modules to infer domains and calculate dependencies.
 * Works with any language that has a package/module concept.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ResolvedFile, SupportedLanguage } from '../types.js';
import type {
  Domain,
  DomainConfig,
  DomainsConfigFile,
  DomainAnalysisResult,
  DomainDependency,
  DomainInferenceOptions,
} from './types.js';

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
// Constants
// =============================================================================

/**
 * Default segment index for domain extraction by language.
 * This is the index of the segment that typically contains the domain name.
 */
const DEFAULT_DOMAIN_SEGMENT_INDEX: Record<SupportedLanguage, number> = {
  kotlin: 2, // com.example.[domain].*
  java: 2, // com.example.[domain].*
  typescript: 1, // src/[domain]/*
  javascript: 1, // src/[domain]/*
};

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

// =============================================================================
// Config File Loading
// =============================================================================

/**
 * Load domains configuration from file.
 */
async function loadDomainsConfig(configPath?: string): Promise<DomainConfig[]> {
  const paths = configPath
    ? [configPath]
    : ['codegraph.domains.json', '.codegraph/domains.json', 'codegraph.config.json'];

  for (const path of paths) {
    const fullPath = join(process.cwd(), path);
    if (existsSync(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8');
        const config: DomainsConfigFile = JSON.parse(content);
        return config.domains || [];
      } catch {
        // Invalid JSON or structure, continue to next path
      
      }
    }
  }

  return [];
}

// =============================================================================
// Domain Assignment
// =============================================================================

/**
 * Assign packages to configured domains based on patterns.
 */
function assignPackagesToConfiguredDomains(
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

// =============================================================================
// Pattern Matching
// =============================================================================

/**
 * Check if a package matches any of the patterns.
 * Supports glob-style patterns with * and **.
 */
function matchesAnyPattern(pkg: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(pkg, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Match a package against a glob-style pattern.
 */
function matchesPattern(pkg: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // * matches any single segment
  // ** matches any number of segments
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '{{DOUBLE_STAR}}') // Temp placeholder
    .replace(/\*/g, '[^.]+') // * = one segment
    .replace(/\{\{DOUBLE_STAR}}/g, '.*'); // ** = any segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pkg);
}

// =============================================================================
// Domain Inference
// =============================================================================

/**
 * Infer domains from package names.
 */
function inferDomainsFromPackages(
  packages: string[],
  language: SupportedLanguage,
  options: DomainInferenceOptions
): Domain[] {
  const segmentIndex = options.domainSegmentIndex ?? DEFAULT_DOMAIN_SEGMENT_INDEX[language];
  const domainMap = new Map<string, string[]>();

  for (const pkg of packages) {
    const domainName = extractDomainFromPackage(pkg, segmentIndex);
    if (domainName) {
      const existing = domainMap.get(domainName) || [];
      existing.push(pkg);
      domainMap.set(domainName, existing);
    }
  }

  return Array.from(domainMap.entries()).map(([name, matchedPackages]) => ({
    name: capitalize(name),
    patterns: [`*.${name}.*`, `*.${name}`], // Inferred patterns
    matchedPackages,
  }));
}

/**
 * Extract domain name from a package path.
 */
function extractDomainFromPackage(pkg: string, segmentIndex: number): string | null {
  // Handle both dot-separated (Java/Kotlin) and slash-separated (TS/JS) paths
  const separator = pkg.includes('/') ? '/' : '.';
  const segments = pkg.split(separator);

  if (segments.length > segmentIndex) {
    const domainSegment = segments[segmentIndex];
    // Skip common non-domain segments
    const skipSegments = ['domain', 'application', 'infrastructure', 'presentation', 'api', 'impl', 'internal'];
    if (domainSegment && !skipSegments.includes(domainSegment.toLowerCase())) {
      return domainSegment.toLowerCase();
    }
    // If skipped, try next segment
    if (segments.length > segmentIndex + 1) {
      return segments[segmentIndex + 1]?.toLowerCase() || null;
    }
  }

  return null;
}

/**
 * Detect the primary language of the files.
 */
function detectPrimaryLanguage(files: ResolvedFile[]): SupportedLanguage {
  const languageCounts = new Map<SupportedLanguage, number>();

  for (const file of files) {
    const count = languageCounts.get(file.language) || 0;
    languageCounts.set(file.language, count + 1);
  }

  let maxCount = 0;
  let primaryLanguage: SupportedLanguage = 'kotlin';

  for (const [language, count] of languageCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = language;
    }
  }

  return primaryLanguage;
}

// =============================================================================
// Dependency Calculation
// =============================================================================

/**
 * Calculate dependencies between domains based on CALLS and USES.
 */
function calculateDomainDependencies(files: ResolvedFile[], domains: Domain[]): DomainDependency[] {
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

/**
 * Extract package name from a fully qualified name.
 */
function extractPackageFromFqn(fqn: string): string | null {
  const lastDot = fqn.lastIndexOf('.');
  if (lastDot === -1) return null;

  // Keep removing last segment until we find a lowercase segment (likely package)
  let current = fqn.substring(0, lastDot);
  while (current.includes('.')) {
    const lastSegment = current.substring(current.lastIndexOf('.') + 1);
    // If segment starts with uppercase, it's a class name, continue
    if (lastSegment[0] === lastSegment[0]?.toUpperCase() && lastSegment[0] !== lastSegment[0]?.toLowerCase()) {
      current = current.substring(0, current.lastIndexOf('.'));
    } else {
      return current;
    }
  }

  return current || null;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Merge two domain lists, avoiding duplicates.
 */
function mergeDomains(existing: Domain[], inferred: Domain[]): Domain[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));

  for (const domain of inferred) {
    if (!existingNames.has(domain.name.toLowerCase())) {
      result.push(domain);
    }
  }

  return result;
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
