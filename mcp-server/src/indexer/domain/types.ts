/**
 * Domain Types
 *
 * Types for domain inference and configuration.
 * Domains provide a functional grouping of packages/modules for better code navigation.
 *
 * Language-agnostic design:
 * - Kotlin/Java: packages (com.example.payment)
 * - TypeScript/JavaScript: directory paths (src/payment)
 * - Go: packages (github.com/example/payment)
 * - Python: modules (example.payment)
 */

/**
 * Represents a domain in the code graph.
 * A domain groups related packages/modules together (e.g., "Payment", "User", "Order").
 */
export interface Domain {
  /** Unique domain name (e.g., "Payment", "User") */
  name: string;
  /** Optional description for PO context */
  description?: string;
  /** Package/module patterns this domain owns (glob patterns) */
  patterns: string[];
  /** Actual packages/modules matched by the patterns */
  matchedPackages: string[];
}

/**
 * Configuration for a single domain in codegraph.domains.json.
 */
export interface DomainConfig {
  /** Domain name */
  name: string;
  /** Optional description */
  description?: string;
  /**
   * Package/module patterns (glob-style).
   * Examples:
   * - Kotlin/Java: "com.example.payment.*"
   * - TypeScript: "src/payment/**"
   * - Go: "github.com/example/payment/*"
   * - Python: "example.payment.*"
   */
  patterns: string[];
}

/**
 * Root configuration file structure (codegraph.domains.json).
 */
export interface DomainsConfigFile {
  /** List of domain configurations */
  domains: DomainConfig[];
}

/**
 * Result of domain analysis.
 */
export interface DomainAnalysisResult {
  /** Inferred/configured domains */
  domains: Domain[];
  /** Dependencies between domains */
  dependencies: DomainDependency[];
  /** Packages/modules that couldn't be assigned to a domain */
  unassignedPackages: string[];
}

/**
 * Represents a dependency between two domains.
 * Calculated from cross-domain CALLS and USES relationships.
 */
export interface DomainDependency {
  /** Source domain name */
  from: string;
  /** Target domain name */
  to: string;
  /** Number of cross-domain references */
  weight: number;
}

/**
 * Options for domain inference.
 */
export interface DomainInferenceOptions {
  /** Path to codegraph.domains.json (optional override) */
  configPath?: string;
  /**
   * Segment index to extract domain name from package/module path.
   * Default varies by language:
   * - Kotlin/Java: 2 (com.example.[domain].*)
   * - TypeScript: 1 (src/[domain]/*)
   * - Go: 3 (github.com/org/repo/[domain]/*)
   * - Python: 1 (example.[domain].*)
   */
  domainSegmentIndex?: number;
}
