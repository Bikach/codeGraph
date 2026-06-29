/**
 * GraphStore — code graph storage abstraction (Phase 1 of PLAN.md §6.3).
 *
 * Contract expressed in BUSINESS OPERATIONS (never `query(cypher)`) so the tools no
 * longer know about the storage dialect. Implemented by `EmbeddedStore` (LadybugDB).
 *
 * Contract rules (every implementation must honor them):
 *   - The store applies NO defaults. The caller (handler) resolves
 *     depth(=2) / impact depth(=3) / maxDepth(=5) / direction('both') / etc. BEFORE calling.
 *     Required fields (`depth`, `maxDepth`) therefore always arrive resolved.
 *   - User-facing messages stay in the handler:
 *       * "No path found ..." when findPath returns null;
 *       * "ERROR: No indexed project found ..." when findProject returns null.
 *   - The store owns multi-query orchestration + deduplication + result ORDER
 *     (getNeighbors, getImpact, getImplementations return already-ordered lists).
 *     Handlers only format.
 *   - No backend specificity must leak above this interface.
 */

/** Node kinds at the DOMAIN level (not backend labels). */
export type NodeKind = 'class' | 'interface' | 'object' | 'function' | 'property';

/** get-impact does not accept 'object' (per its MCP definition). */
export type ImpactNodeKind = 'class' | 'interface' | 'function' | 'property';

/*
 * Note on `type: string` in the results below:
 * current values mix casing — capitalized ('Class') in getNeighbors and the "dependents"
 * block of getImpact, lowercase ('class') elsewhere, and 'package'/'unknown' possible in
 * findPath. We preserve this behavior EXACTLY (the integration tests pin it). Normalizing the
 * casing + tightening these fields to `NodeKind` is a dedicated later cleanup, definitely not
 * during the interface extraction.
 */

export interface ProjectRef {
  path: string;
  name: string;
}

export interface NodeRef {
  name: string;
  type: string;
  visibility: string;
  filePath: string;
  lineNumber: number;
}

export interface CallRef {
  functionName: string;
  className?: string;
  filePath: string;
  lineNumber: number;
  depth: number;
  /** Set when this caller reaches the target through an interface it implements (port↔adapter). */
  viaInterface?: string;
}

export interface NeighborRef {
  name: string;
  type: string;
  direction: 'incoming' | 'outgoing';
  /** Hop distance from the queried node (level at which it was first reached via BFS). */
  depth: number;
  filePath?: string;
}

export interface ImplementationRef {
  name: string;
  filePath: string;
  lineNumber: number;
  isDirect: boolean;
}

export interface ImpactRef {
  name: string;
  type: string;
  impactType: 'caller' | 'dependent' | 'implementor' | 'child';
  depth: number;
  filePath: string;
  lineNumber: number;
}

export interface PathStepRef {
  step: number;
  type: string;
  name: string;
  relationship: string;
  filePath: string;
  lineNumber: number;
}

export interface SymbolRef {
  name: string;
  type: string;
  visibility: string;
  lineNumber: number;
}

/**
 * Hotspot role from the in/out balance: `ripple` = mostly depended-upon (change blast radius —
 * ports, providers, value objects), `fanout` = mostly depends-on (composition roots, controllers,
 * DI hooks — local complexity, no downstream ripple), `hub` = both high.
 */
export type GodNodeRole = 'ripple' | 'fanout' | 'hub';

/**
 * A "god node" = a highly connected node (hotspot). `degree` is the SEMANTIC coupling degree:
 * incident edges (incoming + outgoing) over CALLS/USES/EXTENDS/IMPLEMENTS. DECLARES is excluded
 * on purpose — it is purely structural (a class → its own methods), so it would measure SIZE
 * (how many methods) rather than COUPLING (how connected). Self-loops are excluded.
 * NB: degree counts RAW edges (a class using a type in 3 methods counts 3), not distinct
 * dependents — get_impact answers the distinct-blast-radius question.
 */
export interface GodNodeRef {
  name: string;
  type: string;
  role: GodNodeRole;
  degree: number;
  inDegree: number;
  outDegree: number;
  filePath: string;
  lineNumber: number;
}

/** A named functional grouping of packages/modules (persisted at indexing time). */
export interface DomainRef {
  name: string;
  fileCount: number;
  packages: string[];
}

/** A weighted dependency between two domains (count of cross-domain references). */
export interface DomainDependencyRef {
  from: string;
  to: string;
  weight: number;
}

/**
 * A 2-cycle between two domains: both A→B and B→A exist (mutual coupling — a DDD smell). Canonical
 * orientation `a < b`; `weightAtoB`/`weightBtoA` are the two directed weights.
 */
export interface DomainCycleRef {
  a: string;
  b: string;
  weightAtoB: number;
  weightBtoA: number;
}

/**
 * An emergent module from topological clustering (read-time, seeded Louvain). Independent of the
 * package tree: its `packages` count vs the package grouping is the divergence insight (a community
 * spanning many packages = real cohesion the foldering hides).
 */
export interface CommunityRef {
  /** Label derived from the community's dominant package (e.g. "Download"). */
  name: string;
  /** Number of types (Class/Interface/Object) in the community. */
  size: number;
  /** Distinct packages the community spans (count) — >1 means it cuts across the package tree. */
  packageCount: number;
  /** The packages it spans, dominant-first (capped for output). */
  packages: string[];
}

/**
 * The "project map" answer: named modules + their cross-module dependencies + the hotspots. Fuses
 * the persisted domain analysis with the read-time god-nodes computation behind a single tool.
 */
export interface ModuleOverview {
  domains: DomainRef[];
  dependencies: DomainDependencyRef[];
  /** Mutual-coupling pairs (A↔B) extracted from `dependencies` — surfaced for quick DDD inspection. */
  cycles: DomainCycleRef[];
  hotspots: GodNodeRef[];
  /** Emergent modules from topological clustering (seeded Louvain), shown alongside `domains`. */
  communities: CommunityRef[];
}

export interface GraphStore {
  // — Lifecycle —
  // EmbeddedStore opens/closes its LadybugDB file.
  open(): Promise<void>;
  close(): Promise<void>;

  // — Project —
  // Returns the project whose path covers `projectPath` (semantics: `projectPath STARTS WITH
  // project.path`, i.e. a sub-folder matches its parent project), or null if none. The error
  // message stays in the handler.
  findProject(projectPath: string): Promise<ProjectRef | null>;

  // All indexed projects — lets a tool detect a multi-project graph and scope/warn accordingly.
  listProjects(): Promise<ProjectRef[]>;

  // — Search —
  // `match`: 'exact' = strictly equal name; 'contains' = case-insensitive substring (default
  // behavior). The technique (regex, full-text index…) is an internal detail.
  searchNodes(params: {
    query: string;
    match?: 'exact' | 'contains';
    nodeTypes?: NodeKind[];
    limit?: number;
    projectPath?: string;
  }): Promise<NodeRef[]>;

  // — Call graph (traversal bounded by `depth`) —
  getCallers(params: {
    functionName: string;
    className?: string;
    depth: number;
    /** 'main' drops callers defined in test files; 'all' (default) keeps them. */
    scope?: 'main' | 'all';
    projectPath?: string;
    /** Disambiguate a homonymous free function: keep only the queried function whose file path contains this. */
    filePath?: string;
  }): Promise<CallRef[]>;

  getCallees(params: {
    functionName: string;
    className?: string;
    depth: number;
    /** 'main' drops callees defined in test files; 'all' (default) keeps them. */
    scope?: 'main' | 'all';
    projectPath?: string;
    /** Disambiguate a homonymous free function: keep only the queried function whose file path contains this. */
    filePath?: string;
  }): Promise<CallRef[]>;

  // — Neighbors (dependencies/dependents); list deduplicated by name —
  getNeighbors(params: {
    nodeName: string;
    direction: 'incoming' | 'outgoing' | 'both';
    /** Hops to traverse (1 = direct neighbors only). Defaults to 1. */
    depth?: number;
    includeExternal?: boolean;
    /** 'main' drops neighbors defined in test files; 'all' (default) keeps them. */
    scope?: 'main' | 'all';
    projectPath?: string;
  }): Promise<NeighborRef[]>;

  // — Interface implementations (direct, then indirect if requested) —
  getImplementations(params: {
    interfaceName: string;
    includeIndirect?: boolean;
    projectPath?: string;
  }): Promise<ImplementationRef[]>;

  // — Impact analysis (callers/dependents/implementors/children depending on nodeType) —
  getImpact(params: {
    nodeName: string;
    nodeType?: ImpactNodeKind;
    depth: number;
    /** 'main' drops impacted nodes defined in test files; 'all' (default) keeps them. */
    scope?: 'main' | 'all';
    projectPath?: string;
  }): Promise<ImpactRef[]>;

  // — Shortest path —
  // `relationshipTypes`: DOMAIN relationship names (CALLS, EXTENDS, USES… see docs/SCHEMA.md),
  // shared by all backends. Returns null when no path exists (the handler formats the message).
  findPath(params: {
    fromNode: string;
    toNode: string;
    maxDepth: number;
    relationshipTypes?: string[];
    projectPath?: string;
    /** Follow edge direction (default true = flow A->B). False = undirected connectivity. */
    directed?: boolean;
  }): Promise<PathStepRef[] | null>;

  // — Symbols declared in a file —
  getFileSymbols(params: {
    filePath: string;
    includePrivate?: boolean;
    projectPath?: string;
  }): Promise<SymbolRef[]>;

  // — Global analysis: god nodes (hotspots by semantic degree) —
  // Computed at READ time from the graph topology (pure derivative of degree, no persistence /
  // no schema change). Returns the `topN` most connected nodes, already ordered by `sortBy`.
  //   `scope`  : 'main' (prod sub-graph — excludes test nodes from BOTH endpoints, default),
  //             'test' (test sub-graph), or 'all'. Test detection reuses isTestPath.
  //   `sortBy` : 'in' (ripple/blast radius, default), 'out' (fan-out/complexity) or 'degree'.
  getGodNodes(params: {
    topN: number;
    scope?: 'main' | 'test' | 'all';
    sortBy?: 'in' | 'out' | 'degree';
    projectPath?: string;
    /** Drop trivial accessors (get/set/is/has<Field> backed by a real property) from the ranking. */
    excludeAccessors?: boolean;
  }): Promise<GodNodeRef[]>;

  // — Global analysis: module/project map (named domains + cross-domain deps + hotspots) —
  // Reads the persisted domain analysis and fuses it with the read-time god-nodes (topN hotspots).
  //   `scope`: 'main' (prod only — excludes test files from counts/deps/hotspots, default) or 'all'.
  getModuleOverview(params: {
    topN: number;
    scope?: 'main' | 'all';
    projectPath?: string;
    /** Compute the topological communities (seeded Louvain). Off by default — see CommunityRef. */
    includeCommunities?: boolean;
    /** Drop trivial accessors from the hotspots ranking (forwarded to getGodNodes). */
    excludeAccessors?: boolean;
  }): Promise<ModuleOverview>;
}
