/**
 * Shared test fixtures for the embedded store split tests.
 * Moved verbatim from embedded-store.test.ts.
 */

import type {
  ResolvedFile,
  ParsedFunction,
  ParsedClass,
  ParsedProperty,
  ParsedParameter,
  Visibility,
} from '../../../indexer/types.js';

export const loc = (filePath: string, line: number) => ({
  filePath,
  startLine: line,
  startColumn: 0,
  endLine: line,
  endColumn: 1,
});

export const param = (name: string, type: string): ParsedParameter => ({ name, type, annotations: [] });

export const fn = (
  name: string,
  filePath: string,
  line: number,
  visibility: Visibility = 'public',
  parameters: ParsedParameter[] = [],
  returnType?: string
): ParsedFunction => ({
  name,
  visibility,
  parameters,
  returnType,
  isAbstract: false,
  isSuspend: false,
  isExtension: false,
  annotations: [],
  location: loc(filePath, line),
  calls: [],
});

export const prop = (
  name: string,
  filePath: string,
  line: number,
  visibility: Visibility = 'public',
  type?: string
): ParsedProperty => ({
  name,
  type,
  visibility,
  isVal: true,
  annotations: [],
  location: loc(filePath, line),
});

export const cls = (
  name: string,
  filePath: string,
  line: number,
  functions: ParsedFunction[],
  options: {
    kind?: ParsedClass['kind'];
    properties?: ParsedProperty[];
    visibility?: Visibility;
    superClass?: string;
    interfaces?: string[];
  } = {}
): ParsedClass => ({
  name,
  kind: options.kind ?? 'class',
  visibility: options.visibility ?? 'public',
  isAbstract: false,
  isData: false,
  isSealed: false,
  superClass: options.superClass,
  interfaces: options.interfaces ?? [],
  annotations: [],
  properties: options.properties ?? [],
  functions,
  nestedClasses: [],
  location: loc(filePath, line),
});

export const emptyFile = (overrides: Partial<ResolvedFile>): ResolvedFile => ({
  filePath: '/app/F.kt',
  language: 'kotlin',
  packageName: 'app',
  imports: [],
  reexports: [],
  classes: [],
  topLevelFunctions: [],
  topLevelProperties: [],
  typeAliases: [],
  destructuringDeclarations: [],
  objectExpressions: [],
  resolvedCalls: [],
  ...overrides,
});

// Shared call-graph fixture (reused across the embedded store tests for behavioral parity):
//   foo() [top-level] --CALLS--> bar() [method of Repo] --CALLS--> baz() [top-level]
//   FQNs: app.foo, app.Repo (class) / app.Repo.bar (method), app.baz
export const callGraphFile = emptyFile({
  topLevelFunctions: [fn('foo', '/app/Service.kt', 5), fn('baz', '/app/Util.kt', 20)],
  classes: [cls('Repo', '/app/Repo.kt', 1, [fn('bar', '/app/Repo.kt', 10)])],
  resolvedCalls: [
    { fromFqn: 'app.foo', toFqn: 'app.Repo.bar', location: loc('/app/Service.kt', 6) },
    { fromFqn: 'app.Repo.bar', toFqn: 'app.baz', location: loc('/app/Repo.kt', 11) },
  ],
});
