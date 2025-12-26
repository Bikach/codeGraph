import type { SupportedLanguage } from '../../types.js';
import type { Domain, DomainInferenceOptions } from '../types.js';
import { extractDomainFromPackage } from './extract-domain-from-package.js';
import { capitalize } from '../utils/index.js';

/**
 * Default segment index for domain extraction by language.
 * This is the index of the segment that typically contains the domain name.
 */
export const DEFAULT_DOMAIN_SEGMENT_INDEX: Record<SupportedLanguage, number> = {
  kotlin: 2, // com.example.[domain].*
  java: 2, // com.example.[domain].*
  typescript: 1, // src/[domain]/*
  javascript: 1, // src/[domain]/*
};

/**
 * Infer domains from package names.
 */
export function inferDomainsFromPackages(
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
