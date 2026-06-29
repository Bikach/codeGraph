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
import { inferModulePath, DEFAULT_SOURCE_ROOTS } from '../module/index.js';
import path from 'path';

/**
 * The build module a file belongs to = the directory just above its `src` root (Maven/Gradle lay out
 * each module as `<module>/src/main/...`). Returns undefined when `src` sits at the project root (single
 * module) or is absent. Used to group a multi-module build by module (P3) instead of by package — on a
 * Maven monorepo every package is `com.acme.*`, so package grouping collapses all modules into one.
 */
function moduleOwnerOf(filePath: string, projectPath: string, sourceRoots: string[]): string | undefined {
  const rel = path.relative(path.normalize(projectPath), path.normalize(filePath));
  if (!rel || rel.startsWith('..')) return undefined;
  const parts = rel.split(path.sep).slice(0, -1); // drop the file name
  const srcIdx = parts.findIndex((p) => sourceRoots.includes(p));
  return srcIdx > 0 ? parts[srcIdx - 1] : undefined;
}

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
  // Early return for empty input
  if (files.length === 0) {
    return {
      domains: [],
      dependencies: [],
      unassignedPackages: [],
    };
  }

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
// Graph-oriented analysis (cross-language, for persistence — §3bis-B)
// =============================================================================

/** A domain ready to persist: its name + the packages/modules it owns. */
export interface GraphDomain {
  name: string;
  packages: string[];
}

/**
 * Cross-language domain analysis result. `fileDomain` maps every grouped file → its domain name;
 * the writer uses it to derive per-domain file counts AND cross-domain dependencies from the
 * persisted graph edges (so the weighting matches god-nodes exactly).
 */
export interface GraphDomainAnalysis {
  domains: GraphDomain[];
  fileDomain: Map<string, string>;
  /** filePath → group key (package/module path). Lets the writer derive prod-only package lists. */
  fileGroupKey?: Map<string, string>;
}

export interface GraphDomainOptions {
  /** Absolute project root — needed to infer module paths for TS/JS (no package declaration). */
  projectPath: string;
  /** Optional codegraph.domains.json override. */
  configPath?: string;
  /** Source roots to strip when inferring module paths (TS/JS). */
  sourceRoots?: string[];
  /** Override the domain segment index (else: 0 for slash/module paths, language default otherwise). */
  domainSegmentIndex?: number;
}

/**
 * Domain analysis for the persisted graph. Works across languages by grouping every file under a
 * "group key": its package (Kotlin/Java) or, when there is none, its inferred module path (TS/JS).
 * Returns the named domains + a `file → domain` map. Dependency weighting is NOT computed here — the
 * writer derives it from the persisted graph edges (CALLS/USES/EXTENDS/IMPLEMENTS), so DOMAIN_DEPS
 * counts the same edges as god-nodes.
 */
export async function analyzeDomainsForGraph(
  files: ResolvedFile[],
  options: GraphDomainOptions
): Promise<GraphDomainAnalysis> {
  if (files.length === 0) return { domains: [], fileDomain: new Map() };

  // Multi-module build detection (P3): a Maven/Gradle module is the directory above `src`
  // (`<module>/src/main/...`). When ≥2 distinct modules exist, group by module — packages alone
  // (all `com.acme.*`) would collapse every module into a single domain and yield no cross-module deps.
  const sourceRoots = options.sourceRoots ?? DEFAULT_SOURCE_ROOTS;
  const owners = new Map<string, string | undefined>();
  for (const file of files) owners.set(file.filePath, moduleOwnerOf(file.filePath, options.projectPath, sourceRoots));
  const multiModule = new Set([...owners.values()].filter((o): o is string => !!o)).size >= 2;

  // 1. Group key per file: module (multi-module), else package, else inferred module path.
  const fileGroupKey = new Map<string, string>();
  for (const file of files) {
    const key = multiModule
      ? owners.get(file.filePath) // module name; orphan files (no nested src) are skipped
      : file.packageName ??
        inferModulePath(file.filePath, { projectPath: options.projectPath, sourceRoots: options.sourceRoots });
    if (key) fileGroupKey.set(file.filePath, key);
  }
  const groupKeys = [...new Set(fileGroupKey.values())];
  if (groupKeys.length === 0) return { domains: [], fileDomain: new Map() };

  // 2. Domains: config file first, else inference. TS/JS module paths are src-stripped, so the domain
  //    sits at segment 0 (≡ "the segment right after src"); dotted packages fall back to the inference
  //    default. We key on the LANGUAGE here, not the path shape: a single-segment key like `auth` is
  //    ambiguous (TS module vs Kotlin package), so only the language disambiguates it.
  const language = detectPrimaryLanguage(files);
  const slash = language === 'typescript' || language === 'javascript';
  const inferOptions: DomainInferenceOptions = {
    // In multi-module mode the group key IS the module name (single segment) → take it as-is (index 0).
    domainSegmentIndex: options.domainSegmentIndex ?? (multiModule || slash ? 0 : undefined),
  };

  const configDomains = await loadDomainsConfig(options.configPath);
  let domains: Domain[];
  if (configDomains.length > 0) {
    const assigned = assignPackagesToConfiguredDomains(groupKeys, configDomains);
    domains = assigned.domains;
    if (assigned.unassigned.length > 0) {
      domains = mergeDomains(domains, inferDomainsFromPackages(assigned.unassigned, language, inferOptions));
    }
  } else {
    domains = inferDomainsFromPackages(groupKeys, language, inferOptions);
  }

  // 3. group key → domain, then file → domain.
  const groupKeyToDomain = new Map<string, string>();
  for (const d of domains) for (const pkg of d.matchedPackages) groupKeyToDomain.set(pkg, d.name);
  const fileDomain = new Map<string, string>();
  for (const [filePath, groupKey] of fileGroupKey) {
    const domainName = groupKeyToDomain.get(groupKey);
    if (domainName) fileDomain.set(filePath, domainName);
  }

  const graphDomains: GraphDomain[] = domains
    .map((d) => ({ name: d.name, packages: d.matchedPackages }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { domains: graphDomains, fileDomain, fileGroupKey };
}

