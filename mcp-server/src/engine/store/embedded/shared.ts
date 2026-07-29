/**
 * Shared, stateless helpers + table-name constants used by both the embedded reader and writer.
 * Moved verbatim from the original embedded-store.ts (no logic change).
 */

/** Domain FQN join (same rule as the writer's buildFqn), inlined to avoid importing the writer. */
export const fqnOf = (pkg: string | undefined, ...parts: string[]): string =>
  (pkg ? [pkg, ...parts] : parts).filter(Boolean).join('.');

/** Node tables that count as file "symbols" (mirrors the writer's label whitelist). All have filePath. */
export const SYMBOL_TABLES = ['Class', 'Interface', 'Function', 'Property', 'Object'] as const;

/** Every node table (symbols + Project + Domain) and every rel table — used by clearGraph. */
export const ALL_NODE_TABLES = [...SYMBOL_TABLES, 'Project', 'Domain'];
export const REL_TABLES = ['CALLS', 'DECLARES', 'EXTENDS', 'IMPLEMENTS', 'USES', 'DEPENDS_ON'];

/** Codepoint string comparison (matches the ORDER BY semantics the integration tests pin). */
export const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Heuristic test-file detection (used to rank prod code above test code in searchNodes).
 * Kept language-agnostic: a `test(s)`/`__tests__` path segment (Kotlin/Java `src/test/…`,
 * JS `__tests__/`), or a `.test.`/`.spec.` filename suffix (JS/TS).
 */
export const isTestPath = (filePath: string): boolean =>
  /(^|\/)(tests?|__tests__)\//i.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(filePath);

/** Lowercased node type from a table label (mirrors the find-path handler's getNodeType). */
export const PATH_NODE_TYPES = ['Class', 'Interface', 'Function', 'Property', 'Object', 'Package'];
export const nodeTypeOf = (label: string): string =>
  PATH_NODE_TYPES.includes(label) ? label.toLowerCase() : 'unknown';

/** A LadybugDB path value: ordered nodes + ordered relationships (see probe output). */
export interface LbugPath {
  _nodes: Array<Record<string, unknown>>;
  _rels: Array<Record<string, unknown>>;
}
