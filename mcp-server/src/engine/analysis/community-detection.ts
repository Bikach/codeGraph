/**
 * Topological community detection (read-time analysis, store-agnostic).
 *
 * Wraps seeded Louvain to surface "emergent modules": groups of types that cluster by coupling,
 * independent of how the code is foldered. Compared against the package/domain grouping, the
 * divergence is the product insight (a package split across modules, or modules spanning packages).
 *
 * DETERMINISM (invariant §5.4): Louvain is stochastic, so we pin every randomness source —
 * a fresh seeded `rng`, `randomWalk: false`, a fixed `resolution`, and SORTED node insertion
 * (graphology preserves insertion order). Same graph in → same partition out, every run.
 */
import { DirectedGraph } from 'graphology';
import louvainImport from 'graphology-communities-louvain';
import seedrandom from 'seedrandom';

/**
 * `graphology-communities-louvain` ships an ESM-style `export default` over a CJS module; under
 * NodeNext, tsc sees the namespace rather than the callable (runtime interop resolves to the fn).
 * Cast to its documented call signature.
 */
const louvain = louvainImport as unknown as (
  graph: DirectedGraph,
  options: { rng?: () => number; randomWalk?: boolean; resolution?: number; getEdgeWeight?: string }
) => { [node: string]: number };

/** Stable seed + resolution — changing either changes the partition, so they are fixed constants. */
const SEED = 'codegraph';
const RESOLUTION = 1;

/** A directed, to-be-weighted edge between two type nodes (FQNs). */
export interface CommunityEdge {
  src: string;
  dst: string;
  /** Coupling weight (e.g. number of underlying references); defaults to 1 if absent. */
  weight?: number;
}

/** A detected community: a stable id (by descending size) + its member FQNs. */
export interface DetectedCommunity {
  id: number;
  members: string[];
}

/** Codepoint comparison — locale-independent, so ordering is deterministic across machines. */
const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Run seeded Louvain over a directed, weighted graph of `nodes` and `edges`.
 * Self-loops, edges to unknown nodes, and isolated nodes (no coupling) are dropped.
 * Returns communities ordered by descending size, with stable ids.
 */
export function detectCommunities(nodes: string[], edges: CommunityEdge[]): DetectedCommunity[] {
  const graph = new DirectedGraph();
  // SORTED insertion → stable internal node order (a determinism precondition).
  for (const node of [...nodes].sort(byCodepoint)) graph.addNode(node);

  // Aggregate parallel edges into a single weighted edge (drop self-loops / unknown endpoints).
  const aggregated = new Map<string, { src: string; dst: string; weight: number }>();
  for (const { src, dst, weight } of edges) {
    if (src === dst || !graph.hasNode(src) || !graph.hasNode(dst)) continue;
    const key = src + ' ' + dst;
    const existing = aggregated.get(key);
    if (existing) existing.weight += weight ?? 1;
    else aggregated.set(key, { src, dst, weight: weight ?? 1 });
  }
  for (const { src, dst, weight } of aggregated.values()) {
    graph.addDirectedEdge(src, dst, { weight });
  }

  // Isolated nodes only produce singleton noise; remove them before clustering.
  for (const node of [...graph.nodes()]) if (graph.degree(node) === 0) graph.dropNode(node);
  if (graph.order === 0) return [];

  const partition = louvain(graph, {
    rng: seedrandom(SEED),
    randomWalk: false,
    resolution: RESOLUTION,
    getEdgeWeight: 'weight',
  });

  // Group members by raw community label (iterate nodes sorted so member lists are stable).
  const byLabel = new Map<number, string[]>();
  for (const [node, label] of Object.entries(partition).sort((a, b) => byCodepoint(a[0], b[0]))) {
    const members = byLabel.get(label);
    if (members) members.push(node);
    else byLabel.set(label, [node]);
  }

  // Re-id by descending size (then first member) so ids are stable regardless of Louvain's labels.
  return [...byLabel.values()]
    .sort((a, b) => b.length - a.length || byCodepoint(a[0] ?? '', b[0] ?? ''))
    .map((members, id) => ({ id, members }));
}
