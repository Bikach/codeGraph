import type { LbugValue, QueryResult } from '@ladybugdb/core';
import type {
  GraphStore,
  ProjectRef,
  NodeRef,
  CallRef,
  NeighborRef,
  ImplementationRef,
  ImpactRef,
  PathStepRef,
  SymbolRef,
  GodNodeRef,
  GodNodeRole,
  DomainRef,
  DomainDependencyRef,
  DomainCycleRef,
  ModuleOverview,
  CommunityRef,
  NodeKind,
  ImpactNodeKind,
} from '../graph-store.js';
import type { EmbeddedConnection } from './connection.js';
import { SYMBOL_TABLES, byCodepoint, isTestPath, nodeTypeOf, type LbugPath } from './shared.js';
import { stripFileQualifier } from '../../../indexer/fqn.js';
import { detectCommunities, type CommunityEdge } from '../../analysis/community-detection.js';

export class EmbeddedReader implements GraphStore {
  constructor(private readonly cx: EmbeddedConnection) {}

  /** Forward to the shared connection so the moved method bodies keep using `this.run(...)` verbatim. */
  private run(statement: string, params?: Record<string, LbugValue>): Promise<QueryResult> {
    return this.cx.run(statement, params);
  }

  // GraphStore lifecycle — delegated to the shared connection (the reader borrows it, never owns it).
  open(): Promise<void> {
    return this.cx.open();
  }
  close(): Promise<void> {
    return this.cx.close();
  }

  async getCallees(params: {
    functionName: string;
    className?: string;
    depth: number;
    scope?: 'main' | 'all';
    projectPath?: string;
    filePath?: string;
  }): Promise<CallRef[]> {
    const { functionName, className, depth, filePath } = params;
    const queryParams: Record<string, LbugValue> = { function_name: functionName };
    // When className is given, require the SOURCE function to be declared by that class
    // (Neo4j uses source.declaringType; we resolve it via the DECLARES edge instead).
    const sourceMatch = className
      ? `MATCH (sourceOwner:Class:Interface:Object)-[:DECLARES]->(source:Function)
         MATCH path = (source)-[:CALLS*1..${depth}]->(callee:Function)`
      : `MATCH path = (source:Function)-[:CALLS*1..${depth}]->(callee:Function)`;
    const classFilter = className ? 'AND sourceOwner.name = $class_name' : '';
    if (className) queryParams.class_name = className;
    // Disambiguate a homonymous free function by the file holding its definition (B-10).
    const fileFilter = filePath ? 'AND source.filePath CONTAINS $file_path' : '';
    if (filePath) queryParams.file_path = filePath;

    const cypher = `
      ${sourceMatch}
      WHERE source.name = $function_name
        AND source <> callee
        ${classFilter}
        ${fileFilter}
      WITH DISTINCT callee, length(path) AS pathDepth
      OPTIONAL MATCH (owner)-[:DECLARES]->(callee)
      RETURN
        callee.name AS functionName,
        owner.name AS className,
        callee.filePath AS filePath,
        callee.lineNumber AS lineNumber,
        pathDepth AS depth
      ORDER BY pathDepth, className, functionName
    `;
    const result = await this.run(cypher, queryParams);
    const rows = await result.getAll();
    return this.filterByScope(this.dedupCallsByMinDepth(rows), params.scope);
  }

  /** Prod/test scope filter: 'main' drops items defined in test files; else keep all. */
  private filterByScope<T extends { filePath?: string }>(items: T[], scope?: 'main' | 'all'): T[] {
    return scope === 'main' ? items.filter((i) => !(i.filePath && isTestPath(i.filePath))) : items;
  }

  async findProject(projectPath: string): Promise<ProjectRef | null> {
    // Neo4j: `WHERE $projectPath STARTS WITH p.path`. There are very few Project nodes, so we fetch
    // them and apply the prefix test in JS (avoids the reversed-operand STARTS WITH dialect risk).
    const result = await this.run('MATCH (p:Project) RETURN p.path AS path, p.name AS name');
    const rows = await result.getAll();
    const match = rows.find((r) => projectPath.startsWith(r.path as string));
    return match ? { path: match.path as string, name: match.name as string } : null;
  }

  async listProjects(): Promise<ProjectRef[]> {
    const rows = await (await this.run('MATCH (p:Project) RETURN p.path AS path, p.name AS name')).getAll();
    return rows
      .map((r) => ({ path: r.path as string, name: r.name as string }))
      .sort((a, b) => byCodepoint(a.path, b.path));
  }

  async searchNodes(params: {
    query: string;
    match?: 'exact' | 'contains';
    nodeTypes?: NodeKind[];
    limit?: number;
    projectPath?: string;
  }): Promise<NodeRef[]> {
    const { query, match, nodeTypes, limit, projectPath } = params;

    // Domain NodeKind -> node table (capitalize first letter), defaulting to every symbol table.
    const tables = nodeTypes?.map((t) => t.charAt(0).toUpperCase() + t.slice(1)) ?? [...SYMBOL_TABLES];
    // 'exact' = strictly equal name; otherwise case-insensitive substring.
    const matchFilter = match === 'exact' ? 'n.name = $query' : 'lower(n.name) CONTAINS lower($query)';
    const projectFilter = projectPath ? 'AND n.filePath STARTS WITH $projectPath' : '';

    const queryParams: Record<string, LbugValue> = { query };
    if (projectPath) queryParams.projectPath = projectPath;

    // No untyped MATCH in LadybugDB: query each table, merge, order by name, then limit (mirrors
    // Neo4j's single multi-label query semantics).
    const rows: NodeRef[] = [];
    for (const table of tables) {
      const cypher = `
        MATCH (n:${table})
        WHERE ${matchFilter}
          ${projectFilter}
        RETURN n.name AS name, n.visibility AS visibility, n.filePath AS filePath, n.lineNumber AS lineNumber
      `;
      const result = await this.run(cypher, queryParams);
      for (const r of await result.getAll()) {
        rows.push({
          name: r.name as string,
          type: table.toLowerCase(),
          visibility: r.visibility as string,
          filePath: r.filePath as string,
          lineNumber: Number(r.lineNumber),
        });
      }
    }

    // Relevance ranking BEFORE the limit, so the cap never sacrifices prod code for test code:
    //   1. exact name match first, 2. src/main before src/test, 3. name, then 4. filePath/line so
    //   homonyms (same name in several files/modules) keep a STABLE order across runs (the DB row
    //   order is not deterministic — a bare name tiebreak leaves equal-named nodes shuffling).
    const q = query.toLowerCase();
    rows.sort((a, b) => {
      const exact = Number(b.name.toLowerCase() === q) - Number(a.name.toLowerCase() === q);
      if (exact !== 0) return exact;
      const test = Number(isTestPath(a.filePath)) - Number(isTestPath(b.filePath));
      if (test !== 0) return test;
      return byCodepoint(a.name, b.name) || byCodepoint(a.filePath, b.filePath) || a.lineNumber - b.lineNumber;
    });
    return limit !== undefined ? rows.slice(0, Math.trunc(limit)) : rows;
  }

  async getCallers(params: {
    functionName: string;
    className?: string;
    depth: number;
    scope?: 'main' | 'all';
    projectPath?: string;
    filePath?: string;
  }): Promise<CallRef[]> {
    const { functionName, className, depth, filePath } = params;
    const queryParams: Record<string, LbugValue> = { function_name: functionName };
    // When className is given, require the TARGET function to be declared by that class.
    const targetMatch = className
      ? `MATCH (targetOwner:Class:Interface:Object)-[:DECLARES]->(target:Function)
         MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target)`
      : `MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target:Function)`;
    const classFilter = className ? 'AND targetOwner.name = $class_name' : '';
    if (className) queryParams.class_name = className;
    // Disambiguate a homonymous free function by the file holding its definition (B-10).
    const fileFilter = filePath ? 'AND target.filePath CONTAINS $file_path' : '';
    if (filePath) queryParams.file_path = filePath;

    const cypher = `
      ${targetMatch}
      WHERE target.name = $function_name
        AND caller <> target
        ${classFilter}
        ${fileFilter}
      WITH DISTINCT caller, length(path) AS pathDepth
      OPTIONAL MATCH (owner)-[:DECLARES]->(caller)
      RETURN
        caller.name AS functionName,
        owner.name AS className,
        caller.filePath AS filePath,
        caller.lineNumber AS lineNumber,
        pathDepth AS depth
      ORDER BY pathDepth, className, functionName
    `;
    const result = await this.run(cypher, queryParams);
    const rows = await result.getAll();

    // Port↔adapter bridge (DDD/hexagonal): callers invoke the PORT (interface), never the adapter.
    // So when className targets an adapter, also surface callers of the same-named method on the
    // interfaces it IMPLEMENTS, labeled with the interface name (viaInterface). Avoids the very
    // misleading "0 callers" when querying a concrete implementation.
    if (className) {
      const bridgeCypher = `
        MATCH (impl:Class:Object)-[:IMPLEMENTS]->(port:Interface)-[:DECLARES]->(target:Function)
        MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target)
        WHERE impl.name = $class_name
          AND target.name = $function_name
          AND caller <> target
          ${fileFilter}
        WITH DISTINCT caller, length(path) AS pathDepth, port.name AS viaInterface
        OPTIONAL MATCH (owner)-[:DECLARES]->(caller)
        RETURN
          caller.name AS functionName,
          owner.name AS className,
          caller.filePath AS filePath,
          caller.lineNumber AS lineNumber,
          pathDepth AS depth,
          viaInterface AS viaInterface
        ORDER BY pathDepth, className, functionName
      `;
      rows.push(...(await (await this.run(bridgeCypher, queryParams)).getAll()));
    }

    return this.filterByScope(this.dedupCallsByMinDepth(rows), params.scope);
  }

  async getNeighbors(params: {
    nodeName: string;
    direction: 'incoming' | 'outgoing' | 'both';
    depth?: number;
    includeExternal?: boolean;
    scope?: 'main' | 'all';
    projectPath?: string;
  }): Promise<NeighborRef[]> {
    const { nodeName, direction, includeExternal, projectPath } = params;
    // Multi-hop BFS over the "depends-on" relation, reusing the depth-1 query per frontier node.
    // depth defaults to 1 (direct neighbors) → identical to the previous single-hop behavior.
    const maxDepth = Math.max(1, params.depth ?? 1);
    const neighbors: NeighborRef[] = [];
    if (direction === 'outgoing' || direction === 'both') {
      neighbors.push(...(await this.bfsNeighbors(nodeName, 'outgoing', maxDepth, includeExternal, projectPath)));
    }
    if (direction === 'incoming' || direction === 'both') {
      neighbors.push(...(await this.bfsNeighbors(nodeName, 'incoming', maxDepth, includeExternal, projectPath)));
    }
    return this.filterByScope(neighbors, params.scope);
  }

  /**
   * Breadth-first expansion of a single direction up to maxDepth. Each level reuses `directNeighbors`
   * (the depth-1 query); a node's reported depth is the level at which it is first reached (min depth).
   * The start node and already-seen nodes are excluded (cycle-safe).
   */
  private async bfsNeighbors(
    start: string,
    direction: 'incoming' | 'outgoing',
    maxDepth: number,
    includeExternal: boolean | undefined,
    projectPath: string | undefined
  ): Promise<NeighborRef[]> {
    const result = new Map<string, NeighborRef>();
    const visited = new Set<string>([start]);
    let frontier = [start];
    for (let level = 1; level <= maxDepth && frontier.length > 0; level++) {
      const next: string[] = [];
      for (const node of frontier) {
        for (const n of await this.directNeighbors(node, direction, includeExternal, projectPath)) {
          if (n.name !== start && !result.has(n.name)) {
            result.set(n.name, { ...n, depth: level });
          }
          if (!visited.has(n.name)) {
            visited.add(n.name);
            next.push(n.name);
          }
        }
      }
      frontier = next;
    }
    // Deterministic output: shallowest first, then by name (BFS insertion order is not stable).
    return [...result.values()].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || byCodepoint(a.name, b.name));
  }

  /** Direct (depth-1) neighbors of `nodeName` in one direction — the original single-hop query. */
  private async directNeighbors(
    nodeName: string,
    direction: 'incoming' | 'outgoing',
    includeExternal: boolean | undefined,
    projectPath: string | undefined
  ): Promise<NeighborRef[]> {
    const queryParams: Record<string, LbugValue> = { node_name: nodeName };
    if (projectPath) queryParams.projectPath = projectPath;
    // Project filter is always on `source` (mirrors the Neo4j handler).
    const projectFilterSource = projectPath ? 'AND source.filePath STARTS WITH $projectPath' : '';

    // LadybugDB supports multi-label nodes (Class:Interface:Object), multi-rel-types
    // (EXTENDS|IMPLEMENTS) and label() — so these stay close to the original Cypher.
    if (direction === 'outgoing') {
      const externalTarget = includeExternal ? '' : 'AND target.filePath IS NOT NULL';
      const directCypher = `
        MATCH (source:Class:Interface:Object)-[:EXTENDS|IMPLEMENTS]->(target:Class:Interface)
        WHERE source.name = $node_name
          ${externalTarget}
          ${projectFilterSource}
        RETURN DISTINCT target.name AS name, label(target) AS type, target.filePath AS filePath
      `;
      const usesCypher = `
        MATCH (source:Class:Interface:Object)-[:DECLARES]->(df:Function)-[:USES]->(target:Class:Interface)
        WHERE source.name = $node_name
          AND source <> target
          ${externalTarget}
          ${projectFilterSource}
        RETURN DISTINCT target.name AS name, label(target) AS type, target.filePath AS filePath
      `;
      // Class-level USES (types of the class's own properties — e.g. injected dependencies).
      const propUsesCypher = `
        MATCH (source:Class:Interface:Object)-[:USES]->(target:Class:Interface)
        WHERE source.name = $node_name
          AND source <> target
          ${externalTarget}
          ${projectFilterSource}
        RETURN DISTINCT target.name AS name, label(target) AS type, target.filePath AS filePath
      `;
      return this.mergeNeighbors([directCypher, propUsesCypher, usesCypher], queryParams, 'outgoing');
    }

    const externalSource = includeExternal ? '' : 'AND source.filePath IS NOT NULL';
    const directCypher = `
      MATCH (source:Class:Interface:Object)-[:EXTENDS|IMPLEMENTS]->(target:Class:Interface)
      WHERE target.name = $node_name
        ${externalSource}
        ${projectFilterSource}
      RETURN DISTINCT source.name AS name, label(source) AS type, source.filePath AS filePath
    `;
    const usesCypher = `
      MATCH (source:Class:Interface:Object)-[:DECLARES]->(df:Function)-[:USES]->(target:Class:Interface)
      WHERE target.name = $node_name
        AND source <> target
        ${externalSource}
        ${projectFilterSource}
      RETURN DISTINCT source.name AS name, label(source) AS type, source.filePath AS filePath
    `;
    // Class-level USES incoming: who has a property of this type (e.g. who injects it).
    const propUsesCypher = `
      MATCH (source:Class:Interface:Object)-[:USES]->(target:Class:Interface)
      WHERE target.name = $node_name
        AND source <> target
        ${externalSource}
        ${projectFilterSource}
      RETURN DISTINCT source.name AS name, label(source) AS type, source.filePath AS filePath
    `;
    return this.mergeNeighbors([directCypher, propUsesCypher, usesCypher], queryParams, 'incoming');
  }

  /** Run the neighbor queries (in order) and dedup by name (first wins). */
  private async mergeNeighbors(
    cyphers: string[],
    params: Record<string, LbugValue>,
    direction: 'incoming' | 'outgoing'
  ): Promise<NeighborRef[]> {
    const rows: Array<Record<string, unknown>> = [];
    for (const cypher of cyphers) {
      const result = await this.run(cypher, params);
      rows.push(...(await result.getAll()));
    }

    // Total-order the rows so dedup-by-name keeps the SAME homonym every run (the DB row order is not
    // stable), and the resulting list is reproducible — important for diff/cache and headless runs.
    rows.sort(
      (a, b) =>
        byCodepoint(a.name as string, b.name as string) ||
        byCodepoint((a.filePath as string) ?? '', (b.filePath as string) ?? '') ||
        byCodepoint((a.type as string) ?? '', (b.type as string) ?? '')
    );

    const map = new Map<string, NeighborRef>();
    for (const r of rows) {
      const name = r.name as string;
      if (!map.has(name)) {
        map.set(name, {
          name,
          type: r.type as string,
          direction,
          depth: 1,
          filePath: (r.filePath as string | null) ?? undefined,
        });
      }
    }
    return [...map.values()];
  }

  async getImplementations(params: {
    interfaceName: string;
    includeIndirect?: boolean;
    projectPath?: string;
  }): Promise<ImplementationRef[]> {
    const { interfaceName, includeIndirect, projectPath } = params;
    const queryParams: Record<string, LbugValue> = { interface_name: interfaceName };
    if (projectPath) queryParams.projectPath = projectPath;
    const projectFilter = projectPath ? 'AND c.filePath STARTS WITH $projectPath' : '';

    // Direct subtypes, ordered by name. The target may be an INTERFACE (matched via IMPLEMENTS) or an
    // abstract/base CLASS (matched via EXTENDS) — multi-rel + multi-label target covers both. Without
    // the EXTENDS branch, abstract base classes (e.g. NamedEntity -> Pet/Specialty) returned nothing.
    const directCypher = `
      MATCH (c:Class)-[:IMPLEMENTS|EXTENDS]->(t:Class:Interface)
      WHERE t.name = $interface_name
        ${projectFilter}
      RETURN c.name AS name, c.filePath AS filePath, c.lineNumber AS lineNumber
    `;
    const directResult = await this.run(directCypher, queryParams);
    const directRows = (await directResult.getAll()).map((r) => ({
      name: r.name as string,
      filePath: r.filePath as string,
      lineNumber: Number(r.lineNumber),
      isDirect: true,
    }));
    directRows.sort((a, b) => byCodepoint(a.name, b.name) || byCodepoint(a.filePath, b.filePath) || a.lineNumber - b.lineNumber);

    const implementations: ImplementationRef[] = [...directRows];

    if (includeIndirect) {
      // Indirect subtypes, two transitive shapes (LadybugDB lacks Neo4j's `NOT (c)-[:IMPLEMENTS]->(i)`
      // predicate, so we exclude direct ones in JS). Bounded depth 10 covers any realistic hierarchy.
      //   (a) interface reached via a superclass: c -EXTENDS*-> parent -IMPLEMENTS-> Interface
      //   (b) abstract/base class reached transitively: c -EXTENDS*-> Class
      const directNames = new Set(directRows.map((r) => r.name));
      const indirectViaInterface = `
        MATCH (c:Class)-[:EXTENDS*1..10]->(parent:Class)-[:IMPLEMENTS]->(i:Interface)
        WHERE i.name = $interface_name
          ${projectFilter}
        RETURN DISTINCT c.name AS name, c.filePath AS filePath, c.lineNumber AS lineNumber
      `;
      const indirectViaClass = `
        MATCH (c:Class)-[:EXTENDS*1..10]->(t:Class)
        WHERE t.name = $interface_name
          ${projectFilter}
        RETURN DISTINCT c.name AS name, c.filePath AS filePath, c.lineNumber AS lineNumber
      `;
      const seen = new Set<string>();
      const indirectRows = [
        ...(await (await this.run(indirectViaInterface, queryParams)).getAll()),
        ...(await (await this.run(indirectViaClass, queryParams)).getAll()),
      ]
        .map((r) => ({
          name: r.name as string,
          filePath: r.filePath as string,
          lineNumber: Number(r.lineNumber),
          isDirect: false,
        }))
        .filter((r) => !directNames.has(r.name) && (seen.has(r.name) ? false : seen.add(r.name)));
      indirectRows.sort((a, b) => byCodepoint(a.name, b.name));
      implementations.push(...indirectRows);
    }

    return implementations;
  }

  async getImpact(params: {
    nodeName: string;
    nodeType?: ImpactNodeKind;
    depth: number;
    scope?: 'main' | 'all';
    projectPath?: string;
  }): Promise<ImpactRef[]> {
    const { nodeName, nodeType, depth, projectPath } = params;
    // Every block below filters on $projectPath only when it is set, so it is never an unused param.
    const qp: Record<string, LbugValue> = projectPath
      ? { node_name: nodeName, projectPath }
      : { node_name: nodeName };
    const impacts: ImpactRef[] = [];

    // 1. Callers (functions) — min CALLS distance.
    if (!nodeType || nodeType === 'function') {
      const pf = projectPath ? 'AND caller.filePath STARTS WITH $projectPath' : '';
      const cypher = `
        MATCH path = (caller:Function)-[:CALLS*1..${depth}]->(target:Function)
        WHERE target.name = $node_name AND caller <> target ${pf}
        RETURN caller.name AS name, caller.filePath AS filePath, caller.lineNumber AS lineNumber, length(path) AS depth
      `;
      const rows = await (await this.run(cypher, qp)).getAll();
      impacts.push(...this.minDepthImpacts(rows, 'function', 'caller'));
    }

    // 2. Dependents (types that use this node) — via their functions' param types
    //    (DECLARES→Function→USES) OR directly via their own property types (constructor-injected
    //    deps). The direct class-level USES branch mirrors getNeighbors, so get_impact "dependents"
    //    also surfaces injected dependencies (§3bis A — consistency with the get_neighbors fix).
    if (!nodeType || nodeType === 'class' || nodeType === 'interface') {
      const pf = projectPath ? 'AND dependent.filePath STARTS WITH $projectPath' : '';
      // Constrain the target's table instead of Neo4j's `target:Label` predicate.
      const targetPattern =
        nodeType === 'class' ? 'Class' : nodeType === 'interface' ? 'Interface' : 'Class:Interface';
      const viaFunctionCypher = `
        MATCH (dependent:Class:Interface:Object)-[:DECLARES]->(df:Function)-[:USES]->(target:${targetPattern})
        WHERE target.name = $node_name AND dependent <> target ${pf}
        RETURN DISTINCT dependent.name AS name, label(dependent) AS type, dependent.filePath AS filePath, dependent.lineNumber AS lineNumber
      `;
      // Direct class-level USES (the dependent's own property types — e.g. injected dependencies).
      const viaPropertyCypher = `
        MATCH (dependent:Class:Interface:Object)-[:USES]->(target:${targetPattern})
        WHERE target.name = $node_name AND dependent <> target ${pf}
        RETURN DISTINCT dependent.name AS name, label(dependent) AS type, dependent.filePath AS filePath, dependent.lineNumber AS lineNumber
      `;
      const rows = [
        ...(await (await this.run(viaFunctionCypher, qp)).getAll()),
        ...(await (await this.run(viaPropertyCypher, qp)).getAll()),
      ];
      // Dedup by name (a type can depend via both a param and a property; first wins).
      const byName = new Map<string, ImpactRef>();
      for (const r of rows) {
        const name = r.name as string;
        if (!byName.has(name)) {
          byName.set(name, {
            name,
            type: r.type as string,
            impactType: 'dependent',
            depth: 1,
            filePath: r.filePath as string,
            lineNumber: Number(r.lineNumber),
          });
        }
      }
      impacts.push(...[...byName.values()].sort((a, b) => byCodepoint(a.name, b.name)));
    }

    // 3. Implementors (classes implementing this interface).
    if (!nodeType || nodeType === 'interface') {
      const pf = projectPath ? 'AND impl.filePath STARTS WITH $projectPath' : '';
      const cypher = `
        MATCH (impl:Class)-[:IMPLEMENTS]->(target:Interface)
        WHERE target.name = $node_name ${pf}
        RETURN DISTINCT impl.name AS name, impl.filePath AS filePath, impl.lineNumber AS lineNumber
      `;
      const rows = await (await this.run(cypher, qp)).getAll();
      const mapped: ImpactRef[] = rows.map((r) => ({
        name: r.name as string,
        type: 'class',
        impactType: 'implementor',
        depth: 1,
        filePath: r.filePath as string,
        lineNumber: Number(r.lineNumber),
      }));
      mapped.sort((a, b) => byCodepoint(a.name, b.name) || byCodepoint(a.filePath, b.filePath) || a.lineNumber - b.lineNumber);
      impacts.push(...mapped);
    }

    // 4. Children (classes extending this class) — min EXTENDS distance.
    if (!nodeType || nodeType === 'class') {
      const pf = projectPath ? 'AND child.filePath STARTS WITH $projectPath' : '';
      const cypher = `
        MATCH path = (child:Class)-[:EXTENDS*1..${depth}]->(target:Class)
        WHERE target.name = $node_name ${pf}
        RETURN child.name AS name, child.filePath AS filePath, child.lineNumber AS lineNumber, length(path) AS depth
      `;
      const rows = await (await this.run(cypher, qp)).getAll();
      impacts.push(...this.minDepthImpacts(rows, 'class', 'child'));
    }

    return this.filterByScope(impacts, params.scope);
  }

  /** Group path rows by node name keeping the minimum depth; sort by (depth, name). */
  /**
   * Map call rows to CallRef, keeping only the shortest-path occurrence per distinct function node.
   * Rows arrive ordered by depth asc, so the first occurrence of a node is its min depth. Dedup key
   * is the full node identity (name + class + file + line) so genuinely distinct same-named functions
   * are preserved, while a node reached via several paths/depths collapses to one row.
   */
  private dedupCallsByMinDepth(rows: Array<Record<string, unknown>>): CallRef[] {
    const byNode = new Map<string, CallRef>();
    for (const r of rows) {
      const ref: CallRef = {
        functionName: r.functionName as string,
        className: (r.className as string | null) ?? undefined,
        filePath: r.filePath as string,
        lineNumber: Number(r.lineNumber),
        depth: Number(r.depth),
        viaInterface: (r.viaInterface as string | null) ?? undefined,
      };
      const key = [ref.functionName, ref.className ?? '', ref.filePath, ref.lineNumber].join('\u0000');
      const existing = byNode.get(key);
      if (!existing || ref.depth < existing.depth) byNode.set(key, ref);
    }
    // (depth asc, then className, then name) — same order the per-query ORDER BY produced.
    return [...byNode.values()].sort(
      (a, b) =>
        a.depth - b.depth ||
        byCodepoint(a.className ?? '', b.className ?? '') ||
        byCodepoint(a.functionName, b.functionName) ||
        byCodepoint(a.filePath, b.filePath) ||
        a.lineNumber - b.lineNumber
    );
  }

  private minDepthImpacts(
    rows: Array<Record<string, unknown>>,
    type: 'function' | 'class',
    impactType: 'caller' | 'child'
  ): ImpactRef[] {
    const byName = new Map<string, ImpactRef>();
    for (const r of rows) {
      const name = r.name as string;
      const d = Number(r.depth);
      const existing = byName.get(name);
      if (!existing || d < existing.depth) {
        byName.set(name, {
          name,
          type,
          impactType,
          depth: d,
          filePath: r.filePath as string,
          lineNumber: Number(r.lineNumber),
        });
      }
    }
    return [...byName.values()].sort((a, b) => a.depth - b.depth || byCodepoint(a.name, b.name));
  }

  async findPath(params: {
    fromNode: string;
    toNode: string;
    maxDepth: number;
    relationshipTypes?: string[];
    projectPath?: string;
    directed?: boolean;
  }): Promise<PathStepRef[] | null> {
    const { fromNode, toNode, maxDepth, relationshipTypes, projectPath } = params;
    const directed = params.directed ?? true;
    const relFilter =
      relationshipTypes && relationshipTypes.length > 0 ? `:${relationshipTypes.join('|')}` : '';
    // No untyped MATCH: enumerate the candidate endpoint tables (all code nodes that bear edges).
    const labels = 'Class:Interface:Function:Object:Property';
    const projectFrom = projectPath ? 'AND from.filePath STARTS WITH $projectPath' : '';
    const projectTo = projectPath ? 'AND to.filePath STARTS WITH $projectPath' : '';
    const qp: Record<string, LbugValue> = { from_node: fromNode, to_node: toNode };
    if (projectPath) qp.projectPath = projectPath;

    // Directed `->` (default) follows edge direction = "does `from` reach `to`" (call/dependency flow).
    // Undirected `-` finds mere connectivity (a path may traverse edges against their direction).
    // LadybugDB uses the `SHORTEST` keyword in the rel pattern (not Neo4j's shortestPath()).
    const arrow = directed ? '->' : '-';
    const cypher = `
      MATCH p = (from:${labels})-[${relFilter}* SHORTEST 1..${maxDepth}]${arrow}(to:${labels})
      WHERE from.name = $from_node AND to.name = $to_node AND from <> to
        ${projectFrom}
        ${projectTo}
      RETURN p
      LIMIT 1
    `;
    const result = await this.run(cypher, qp);
    const rows = await result.getAll();
    const path = rows[0]?.p as LbugPath | undefined;
    if (!path) return null;

    const { _nodes: nodes, _rels: rels } = path;
    return nodes.map((node, index) => ({
      step: index,
      type: nodeTypeOf(node._label as string),
      name: node.name as string,
      // step 0 has no incoming relationship; step i comes via rels[i-1].
      relationship: index === 0 ? '-' : (rels[index - 1]!._label as string),
      filePath: (node.filePath as string) || '',
      lineNumber: Number(node.lineNumber) || 0,
    }));
  }

  async getFileSymbols(params: {
    filePath: string;
    includePrivate?: boolean;
    projectPath?: string;
  }): Promise<SymbolRef[]> {
    const { filePath, includePrivate, projectPath } = params;

    // include_private defaults to true (undefined/true => everything); only filter when disabled.
    const visibilityFilter =
      includePrivate === false ? "AND n.visibility IN ['public', 'protected', 'internal']" : '';
    const projectFilter = projectPath ? 'AND n.filePath STARTS WITH $projectPath' : '';

    const queryParams: Record<string, LbugValue> = { file_path: filePath };
    if (projectPath) queryParams.projectPath = projectPath;

    // Per-table (no untyped MATCH); merge then order by lineNumber, type, name (Neo4j parity).
    const rows: Array<SymbolRef & { typeLabel: string }> = [];
    for (const table of SYMBOL_TABLES) {
      const cypher = `
        MATCH (n:${table})
        WHERE (n.filePath = $file_path OR n.filePath ENDS WITH $file_path)
          ${visibilityFilter}
          ${projectFilter}
        RETURN n.name AS name, n.visibility AS visibility, n.lineNumber AS lineNumber
      `;
      const result = await this.run(cypher, queryParams);
      for (const r of await result.getAll()) {
        rows.push({
          name: r.name as string,
          type: table.toLowerCase(),
          typeLabel: table,
          visibility: r.visibility as string,
          lineNumber: Number(r.lineNumber),
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.lineNumber - b.lineNumber ||
        byCodepoint(a.typeLabel, b.typeLabel) ||
        byCodepoint(a.name, b.name)
    );
    return rows.map(({ name, type, visibility, lineNumber }) => ({ name, type, visibility, lineNumber }));
  }

  async getGodNodes(params: {
    topN: number;
    scope?: 'main' | 'test' | 'all';
    sortBy?: 'in' | 'out' | 'degree';
    projectPath?: string;
    excludeAccessors?: boolean;
  }): Promise<GodNodeRef[]> {
    const { topN, projectPath, excludeAccessors } = params;
    const scope = params.scope ?? 'main';
    const sortBy = params.sortBy ?? 'in';
    const qp: Record<string, LbugValue> = projectPath ? { projectPath } : {};

    // Optional: drop trivial accessors (getName/setX/isY) that pollute hotspots. Precise — only when
    // the declaring class actually has a matching property (so `getUserByLogin` etc. survive).
    const propertyFqns = new Set<string>();
    if (excludeAccessors) {
      const propCypher = `MATCH (p:Property) ${projectPath ? 'WHERE p.filePath STARTS WITH $projectPath' : ''} RETURN p.fqn AS fqn`;
      for (const r of await (await this.run(propCypher, qp)).getAll()) {
        propertyFqns.add((r.fqn as string).toLowerCase());
      }
    }
    const isTrivialAccessor = (fqn: string, name: string, type: string): boolean => {
      if (type !== 'function') return false;
      const m = /^(?:get|set|is|has)([A-Z]\w*)$/.exec(name);
      if (!m) return false;
      const field = m[1]!.charAt(0).toLowerCase() + m[1]!.slice(1);
      const classFqn = fqn.slice(0, fqn.lastIndexOf('.'));
      return propertyFqns.has(`${classFqn}.${field}`.toLowerCase());
    };

    // 1. Node metadata for the degree-bearing tables (Property carries no semantic edge → skipped).
    //    Each node is tagged test/prod (isTestPath) so `scope` can keep the relevant sub-graph.
    const meta = new Map<
      string,
      { name: string; type: string; filePath: string; lineNumber: number; isTest: boolean }
    >();
    const where = projectPath ? 'WHERE n.filePath STARTS WITH $projectPath' : '';
    for (const table of ['Class', 'Interface', 'Function', 'Object']) {
      const cypher = `
        MATCH (n:${table})
        ${where}
        RETURN n.fqn AS fqn, n.name AS name, n.filePath AS filePath, n.lineNumber AS lineNumber
      `;
      for (const r of await (await this.run(cypher, qp)).getAll()) {
        const filePath = r.filePath as string;
        meta.set(r.fqn as string, {
          name: r.name as string,
          type: table.toLowerCase(),
          filePath,
          lineNumber: Number(r.lineNumber),
          isTest: isTestPath(filePath),
        });
      }
    }

    // A node is in scope when 'all', or its test-ness matches the requested 'main'/'test' sub-graph.
    const inScope = (fqn: string): boolean => {
      if (scope === 'all') return true;
      const m = meta.get(fqn);
      return m ? (scope === 'test' ? m.isTest : !m.isTest) : false;
    };

    // 2. Every edge over the 4 SEMANTIC relations (DECLARES excluded — structural, = size not
    //    coupling). One multi-rel / multi-label query (dialect supports both); self-loops excluded.
    //    Endpoints constrained to the project when scoped. The `scope` filter keeps only edges whose
    //    BOTH endpoints match, so a prod node's degree never counts coupling coming from test code.
    const edgeConds = ['a <> b'];
    if (projectPath) {
      edgeConds.push('a.filePath STARTS WITH $projectPath', 'b.filePath STARTS WITH $projectPath');
    }
    const edgeCypher = `
      MATCH (a:Class:Interface:Function:Object)-[:CALLS|USES|EXTENDS|IMPLEMENTS]->(b:Class:Interface:Function:Object)
      WHERE ${edgeConds.join(' AND ')}
      RETURN a.fqn AS src, b.fqn AS dst
    `;
    const edgeRows = await (await this.run(edgeCypher, qp)).getAll();

    // 3. Accumulate in/out degree per node (in JS — avoids the aggregation-dialect risk).
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const r of edgeRows) {
      const src = r.src as string;
      const dst = r.dst as string;
      if (!inScope(src) || !inScope(dst)) continue;
      outDeg.set(src, (outDeg.get(src) ?? 0) + 1);
      inDeg.set(dst, (inDeg.get(dst) ?? 0) + 1);
    }

    // 4. Build, classify role, drop degree-0 nodes, order by the requested axis, take topN.
    const nodes: GodNodeRef[] = [];
    for (const fqn of new Set([...inDeg.keys(), ...outDeg.keys()])) {
      const m = meta.get(fqn);
      if (!m || !inScope(fqn)) continue;
      if (excludeAccessors && isTrivialAccessor(fqn, m.name, m.type)) continue;
      const inDegree = inDeg.get(fqn) ?? 0;
      const outDegree = outDeg.get(fqn) ?? 0;
      const degree = inDegree + outDegree;
      if (degree === 0) continue;
      nodes.push({
        name: m.name,
        type: m.type,
        role: classifyGodNodeRole(inDegree, outDegree),
        degree,
        inDegree,
        outDegree,
        filePath: m.filePath,
        lineNumber: m.lineNumber,
      });
    }
    const primary =
      sortBy === 'in'
        ? (n: GodNodeRef) => n.inDegree
        : sortBy === 'out'
          ? (n: GodNodeRef) => n.outDegree
          : (n: GodNodeRef) => n.degree;
    nodes.sort(
      (a, b) =>
        primary(b) - primary(a) ||
        b.degree - a.degree ||
        byCodepoint(a.name, b.name) ||
        byCodepoint(a.filePath, b.filePath) ||
        a.lineNumber - b.lineNumber
    );
    return nodes.slice(0, Math.max(0, Math.trunc(topN)));
  }

  async getModuleOverview(params: {
    topN: number;
    scope?: 'main' | 'all';
    projectPath?: string;
    includeCommunities?: boolean;
    excludeAccessors?: boolean;
  }): Promise<ModuleOverview> {
    const { topN, projectPath } = params;
    const prod = (params.scope ?? 'main') !== 'all';
    const qp: Record<string, LbugValue> = projectPath ? { projectPath } : {};
    // Pick the persisted column for the requested scope (whitelisted identifiers, not user input).
    const countCol = prod ? 'prodFileCount' : 'fileCount';
    const packagesCol = prod ? 'prodPackages' : 'packages';
    const weightCol = prod ? 'prodWeight' : 'weight';

    // Persisted domains; drop those with 0 files in the requested scope (e.g. test-only in 'main').
    const domainWhere = projectPath ? 'WHERE d.projectPath = $projectPath' : '';
    const domainRows = await (
      await this.run(
        `MATCH (d:Domain) ${domainWhere}
         RETURN d.name AS name, d.${countCol} AS fileCount, d.${packagesCol} AS packages`,
        qp
      )
    ).getAll();
    const domains: DomainRef[] = domainRows
      .map((r) => ({
        name: r.name as string,
        fileCount: Number(r.fileCount),
        packages: (r.packages as string)?.length ? (r.packages as string).split(',') : [],
      }))
      .filter((d) => d.fileCount > 0)
      .sort((a, b) => b.fileCount - a.fileCount || byCodepoint(a.name, b.name));

    // Persisted cross-domain dependencies (scoped via the source domain's project); drop 0-weight.
    const depWhere = projectPath ? 'WHERE a.projectPath = $projectPath' : '';
    const depRows = await (
      await this.run(
        `MATCH (a:Domain)-[r:DEPENDS_ON]->(b:Domain) ${depWhere}
         RETURN a.name AS fromName, b.name AS toName, r.${weightCol} AS weight`,
        qp
      )
    ).getAll();
    const dependencies: DomainDependencyRef[] = depRows
      .map((r) => ({ from: r.fromName as string, to: r.toName as string, weight: Number(r.weight) }))
      .filter((d) => d.weight > 0)
      .sort((a, b) => b.weight - a.weight || byCodepoint(a.from, b.from) || byCodepoint(a.to, b.to));

    // 2-cycles: pairs with edges in BOTH directions (mutual coupling). Canonical a < b to dedup.
    const weightByPair = new Map<string, number>();
    for (const d of dependencies) weightByPair.set(`${d.from} ${d.to}`, d.weight);
    const cycles: DomainCycleRef[] = [];
    for (const d of dependencies) {
      if (d.from >= d.to) continue;
      const reverse = weightByPair.get(`${d.to} ${d.from}`);
      if (reverse !== undefined) {
        cycles.push({ a: d.from, b: d.to, weightAtoB: d.weight, weightBtoA: reverse });
      }
    }
    cycles.sort(
      (x, y) =>
        y.weightAtoB + y.weightBtoA - (x.weightAtoB + x.weightBtoA) ||
        byCodepoint(x.a, y.a) ||
        byCodepoint(x.b, y.b)
    );

    // Hotspots: read-time god nodes on the same scope (ripple-first), reusing the existing computation.
    const hotspots = await this.getGodNodes({
      topN,
      scope: prod ? 'main' : 'all',
      sortBy: 'in',
      projectPath,
      excludeAccessors: params.excludeAccessors,
    });

    // Communities: read-time seeded Louvain over the type graph. Opt-in — on well-structured projects
    // the package-based domains are already the right grouping; communities help only when packaging
    // is flat/messy. Skipped (and not computed) unless explicitly requested.
    const communities = params.includeCommunities
      ? await this.computeCommunities({ prod, projectPath, qp, topN })
      : [];

    return { domains, dependencies, cycles, hotspots, communities };
  }

  /**
   * Read-time topological clustering (seeded Louvain) at the TYPE level. Function-level edges
   * (CALLS/USES) are projected onto their owning type via DECLARES; EXTENDS/IMPLEMENTS are already
   * type-level. Each community is named after its dominant package. Prod scope drops test-file types.
   */
  private async computeCommunities(args: {
    prod: boolean;
    projectPath?: string;
    qp: Record<string, LbugValue>;
    topN: number;
  }): Promise<CommunityRef[]> {
    const { prod, projectPath, qp, topN } = args;
    const inProdScope = (filePath: string): boolean => !prod || !isTestPath(filePath);

    // 1. Type nodes in scope (Class/Interface/Object).
    const typeFqns = new Set<string>();
    const typeWhere = projectPath ? 'WHERE n.filePath STARTS WITH $projectPath' : '';
    for (const table of ['Class', 'Interface', 'Object']) {
      const rows = await (
        await this.run(`MATCH (n:${table}) ${typeWhere} RETURN n.fqn AS fqn, n.filePath AS filePath`, qp)
      ).getAll();
      for (const r of rows) if (inProdScope(r.filePath as string)) typeFqns.add(r.fqn as string);
    }
    if (typeFqns.size === 0) return [];

    // 2. Function -> owning type (only owners that are in-scope types).
    const funcToType = new Map<string, string>();
    const declWhere = projectPath ? 'WHERE t.filePath STARTS WITH $projectPath' : '';
    for (const table of ['Class', 'Interface', 'Object']) {
      const rows = await (
        await this.run(
          `MATCH (t:${table})-[:DECLARES]->(f:Function) ${declWhere} RETURN t.fqn AS owner, f.fqn AS func`,
          qp
        )
      ).getAll();
      for (const r of rows) {
        const owner = r.owner as string;
        if (typeFqns.has(owner)) funcToType.set(r.func as string, owner);
      }
    }

    // 3. Semantic edges (same relation set + multi-label pattern as god-nodes), then project to types.
    const edgeConds = ['a <> b'];
    if (projectPath) edgeConds.push('a.filePath STARTS WITH $projectPath', 'b.filePath STARTS WITH $projectPath');
    const edgeRows = await (
      await this.run(
        `MATCH (a:Class:Interface:Function:Object)-[:CALLS|USES|EXTENDS|IMPLEMENTS]->(b:Class:Interface:Function:Object)
         WHERE ${edgeConds.join(' AND ')}
         RETURN a.fqn AS src, b.fqn AS dst`,
        qp
      )
    ).getAll();

    const toType = (fqn: string): string | undefined => (typeFqns.has(fqn) ? fqn : funcToType.get(fqn));
    const edges: CommunityEdge[] = [];
    for (const r of edgeRows) {
      const src = toType(r.src as string);
      const dst = toType(r.dst as string);
      if (src && dst && src !== dst) edges.push({ src, dst });
    }

    // 4. Cluster, then label each community by its dominant package.
    const communities = detectCommunities([...typeFqns], edges);

    // Naming: label each community by its most CENTRAL type (highest intra-community degree) — far more
    // informative + distinct than the dominant package's last segment, which collides (many "Domain"/
    // "Model" communities) and mislabels (a cluster's package ≠ what it is about). Build membership +
    // intra-community degree from the projected edges.
    const communityOf = new Map<string, number>();
    communities.forEach((c, idx) => c.members.forEach((m) => communityOf.set(m, idx)));
    const intraDegree = new Map<string, number>();
    for (const { src, dst } of edges) {
      const cs = communityOf.get(src);
      if (cs !== undefined && cs === communityOf.get(dst)) {
        intraDegree.set(src, (intraDegree.get(src) ?? 0) + 1);
        intraDegree.set(dst, (intraDegree.get(dst) ?? 0) + 1);
      }
    }

    const usedNames = new Map<string, number>();
    return communities
      .map((c): CommunityRef => {
        const pkgCounts = new Map<string, number>();
        for (const fqn of c.members) pkgCounts.set(packageOf(fqn), (pkgCounts.get(packageOf(fqn)) ?? 0) + 1);
        const byCount = [...pkgCounts.entries()].sort((a, b) => b[1] - a[1] || byCodepoint(a[0], b[0]));

        // Central member = max intra-community degree (deterministic tiebreak by fqn). Name by its
        // simple type name; fall back to the dominant package when the community has no internal hub.
        const central = [...c.members].sort(
          (a, b) => (intraDegree.get(b) ?? 0) - (intraDegree.get(a) ?? 0) || byCodepoint(a, b)
        )[0];
        let name =
          central && (intraDegree.get(central) ?? 0) > 0
            ? lastSegment(central)
            : capitalize(lastSegment(byCount[0]?.[0] ?? 'module'));
        // Disambiguate identical labels across communities (append the central type's package segment).
        const seen = usedNames.get(name) ?? 0;
        usedNames.set(name, seen + 1);
        if (seen > 0 && central) name = `${name} (${lastSegment(packageOf(central))})`;

        return {
          name,
          size: c.members.length,
          packageCount: pkgCounts.size,
          packages: byCount.slice(0, 6).map(([pkg]) => pkg),
        };
      })
      .slice(0, Math.max(0, Math.trunc(topN)));
  }
}

/** Package of a type FQN = everything before the last dot (e.g. `a.b.C` -> `a.b`). A file-qualified
 *  package-less fqn (`/a/B.ts::C`, B-9) has no package, so strip the qualifier first to avoid splitting
 *  on the dots inside the file path. */
function packageOf(fqn: string): string {
  const name = stripFileQualifier(fqn);
  const i = name.lastIndexOf('.');
  return i < 0 ? name : name.slice(0, i);
}

/** Last dotted segment (e.g. `a.b.service` -> `service`). Used to label a community's dominant package. */
function lastSegment(path: string): string {
  const i = path.lastIndexOf('.');
  return i < 0 ? path : path.slice(i + 1);
}

/** Capitalize the first character (e.g. `service` -> `Service`). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Classify a hotspot by its in/out balance (in-dominant=ripple, out-dominant=fanout, else hub). */
function classifyGodNodeRole(inDegree: number, outDegree: number): GodNodeRole {
  if (inDegree === 0) return 'fanout';
  if (outDegree === 0) return 'ripple';
  if (inDegree >= 2 * outDegree) return 'ripple';
  if (outDegree >= 2 * inDegree) return 'fanout';
  return 'hub';
}
