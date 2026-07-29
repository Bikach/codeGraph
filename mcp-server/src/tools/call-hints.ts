import type { GraphStore } from '../engine/store/graph-store.js';

/**
 * Build a helpful message when get_callers/get_callees returns nothing — disambiguating
 * "the symbol doesn't exist" from "it exists but has no internal callers/callees" (e.g. a method
 * that only calls a library, or an adapter nobody calls directly). Lists where the function is
 * defined so same-named declarations (the interface vs its impl) are discoverable.
 */
export async function emptyCallMessage(
  store: GraphStore,
  kind: 'CALLERS' | 'CALLEES',
  functionName: string,
  className?: string
): Promise<string> {
  const defs = await store.searchNodes({ query: functionName, match: 'exact', nodeTypes: ['function'] });
  const where = className ? ` on '${className}'` : '';

  if (defs.length === 0) {
    return `${kind}: No function named '${functionName}'${where} found in the graph.`;
  }

  const locations = defs.map((d) => `${d.filePath}:${d.lineNumber}`).join(', ');
  return kind === 'CALLERS'
    ? `${kind}: '${functionName}'${where} has no callers in the graph. Defined at: ${locations}.`
    : `${kind}: '${functionName}'${where} has no internal callees (library/external calls aren't indexed). Defined at: ${locations}.`;
}
