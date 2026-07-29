/**
 * Fully-qualified name (FQN) helpers shared by the resolver (symbol table + call resolution) and the
 * embedded writer. They MUST agree byte-for-byte: a graph node is created under one FQN and CALLS/USES
 * edges reference functions by FQN, so any divergence silently drops edges.
 */

/** Separator between the file-path qualifier and the symbol name in a package-less FQN. */
export const FILE_FQN_SEP = '::';

/**
 * FQN of a top-level declaration: a free function/property OR a top-level type (class/interface/object).
 *
 * With a package (Kotlin/Java), it is the usual dotted `package.name`. Without one (TypeScript/JavaScript
 * have no package declarations), the bare `name` is NOT unique across files: two `buildVm` functions or two
 * `JobOrder` interfaces in different files (or different indexed repos) would `MERGE` onto a single graph
 * node, collapsing edges, creating false transitive paths (bug B-8) and resolving cross-repo edges to the
 * wrong project (bug B-9). We therefore qualify package-less symbols by their file path so homonyms stay
 * distinct. The `::` separator never appears in a dotted package FQN, so the two namespaces cannot collide.
 */
export function topLevelSymbolFqn(
  packageName: string | undefined,
  filePath: string,
  name: string
): string {
  return packageName ? `${packageName}.${name}` : `${filePath}${FILE_FQN_SEP}${name}`;
}

/**
 * Strip the `filePath::` qualifier from a (possibly file-qualified) FQN, leaving the dotted remainder
 * (`/a/B.ts::Foo.bar` -> `Foo.bar`; `pkg.Foo.bar` -> `pkg.Foo.bar`). Used by code that parses an FQN by
 * its dots (package/segment extraction) so the dots inside a file path can't be mistaken for separators.
 */
export function stripFileQualifier(fqn: string): string {
  const i = fqn.lastIndexOf(FILE_FQN_SEP);
  return i >= 0 ? fqn.slice(i + FILE_FQN_SEP.length) : fqn;
}
