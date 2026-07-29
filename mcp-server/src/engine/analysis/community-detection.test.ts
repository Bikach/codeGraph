import { describe, it, expect } from 'vitest';
import { detectCommunities, type CommunityEdge } from './community-detection.js';

/** Three disjoint triangles (a*, b*, c*) wired with two sparse cross edges — 3 obvious clusters. */
const NODES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'];
const EDGES: CommunityEdge[] = [
  { src: 'a1', dst: 'a2' }, { src: 'a2', dst: 'a3' }, { src: 'a3', dst: 'a1' },
  { src: 'b1', dst: 'b2' }, { src: 'b2', dst: 'b3' }, { src: 'b3', dst: 'b1' },
  { src: 'c1', dst: 'c2' }, { src: 'c2', dst: 'c3' }, { src: 'c3', dst: 'c1' },
  { src: 'a1', dst: 'b1' }, { src: 'b2', dst: 'c1' },
];

describe('detectCommunities', () => {
  it('recovers the obvious clusters', () => {
    const communities = detectCommunities(NODES, EDGES);
    expect(communities).toHaveLength(3);
    // Each community is exactly one triangle (members are returned sorted).
    const memberSets = communities.map((c) => c.members.sort().join(','));
    expect(memberSets.sort()).toEqual(['a1,a2,a3', 'b1,b2,b3', 'c1,c2,c3']);
  });

  it('is deterministic: identical output across runs (ids + members)', () => {
    const a = detectCommunities(NODES, EDGES);
    const b = detectCommunities(NODES, EDGES);
    expect(b).toEqual(a);
  });

  it('is insertion-order independent (nodes/edges shuffled → same partition)', () => {
    const shuffledNodes = [...NODES].reverse();
    const shuffledEdges = [...EDGES].reverse();
    const fromSorted = detectCommunities(NODES, EDGES);
    const fromShuffled = detectCommunities(shuffledNodes, shuffledEdges);
    expect(fromShuffled).toEqual(fromSorted);
  });

  it('assigns stable ids by descending size', () => {
    // Two clusters of different sizes: a 4-clique and a 2-edge — biggest gets id 0.
    const nodes = ['x1', 'x2', 'x3', 'x4', 'y1', 'y2'];
    const edges: CommunityEdge[] = [
      { src: 'x1', dst: 'x2' }, { src: 'x2', dst: 'x3' }, { src: 'x3', dst: 'x4' }, { src: 'x4', dst: 'x1' },
      { src: 'y1', dst: 'y2' },
    ];
    const communities = detectCommunities(nodes, edges);
    expect(communities[0]?.id).toBe(0);
    expect(communities[0]?.members.length).toBeGreaterThanOrEqual(communities[1]?.members.length ?? 0);
  });

  it('drops isolated nodes and returns empty for an edgeless graph', () => {
    expect(detectCommunities(['lonely1', 'lonely2'], [])).toEqual([]);
  });

  it('ignores self-loops and edges to unknown nodes', () => {
    const communities = detectCommunities(['a1', 'a2'], [
      { src: 'a1', dst: 'a1' }, // self-loop → dropped
      { src: 'a1', dst: 'ghost' }, // unknown endpoint → dropped
      { src: 'a1', dst: 'a2' },
    ]);
    // The unknown 'ghost' node never appears; only the known, connected nodes are clustered.
    const members = communities.flatMap((c) => c.members).sort();
    expect(members).toEqual(['a1', 'a2']);
  });
});
