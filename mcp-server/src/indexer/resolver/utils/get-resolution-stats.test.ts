import { describe, it, expect } from 'vitest';
import { getResolutionStats } from './get-resolution-stats.js';
import type { ResolvedFile, ParsedFunction, ParsedCall, ParsedClass, ResolvedCall } from '../../types.js';

function createCall(name: string): ParsedCall {
  return {
    name,
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
  };
}

function createResolvedCall(fromFqn: string, toFqn: string): ResolvedCall {
  return {
    fromFqn,
    toFqn,
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
  };
}

function createFunction(name: string, calls: ParsedCall[] = []): ParsedFunction {
  return {
    name,
    visibility: 'public',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    parameters: [],
    calls,
    annotations: [],
    isAbstract: false,
    isSuspend: false,
    isExtension: false,
  };
}

function createClass(name: string, functions: ParsedFunction[] = []): ParsedClass {
  return {
    name,
    kind: 'class',
    visibility: 'public',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 100, endColumn: 1 },
    superClass: undefined,
    interfaces: [],
    typeParameters: [],
    functions,
    properties: [],
    nestedClasses: [],
    annotations: [],
    isAbstract: false,
    isData: false,
    isSealed: false,
  };
}

function createResolvedFile(
  topLevelFunctions: ParsedFunction[] = [],
  classes: ParsedClass[] = [],
  resolvedCalls: ResolvedCall[] = []
): ResolvedFile {
  return {
    filePath: '/test/Test.kt',
    language: 'kotlin',
    packageName: 'com.example',
    imports: [],
    reexports: [],
    classes,
    topLevelFunctions,
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    resolvedCalls,
  };
}

describe('getResolutionStats', () => {
  it('should return zeros for empty files', () => {
    const stats = getResolutionStats([]);
    expect(stats).toEqual({
      totalCalls: 0,
      resolvedCalls: 0,
      unresolvedCalls: 0,
      resolutionRate: 1,
    });
  });

  it('should return 100% rate for file with no calls', () => {
    const file = createResolvedFile([createFunction('foo')], [], []);
    const stats = getResolutionStats([file]);
    expect(stats).toEqual({
      totalCalls: 0,
      resolvedCalls: 0,
      unresolvedCalls: 0,
      resolutionRate: 1,
    });
  });

  it('should count calls in top-level functions', () => {
    const file = createResolvedFile(
      [createFunction('foo', [createCall('bar'), createCall('baz')])],
      [],
      [createResolvedCall('com.example.foo', 'com.example.bar')]
    );
    const stats = getResolutionStats([file]);
    expect(stats.totalCalls).toBe(2);
    expect(stats.resolvedCalls).toBe(1);
    expect(stats.unresolvedCalls).toBe(1);
    expect(stats.resolutionRate).toBe(0.5);
  });

  it('should count calls in class functions', () => {
    const cls = createClass('MyClass', [
      createFunction('method1', [createCall('a'), createCall('b')]),
      createFunction('method2', [createCall('c')]),
    ]);
    const file = createResolvedFile(
      [],
      [cls],
      [
        createResolvedCall('com.example.MyClass.method1', 'com.example.a'),
        createResolvedCall('com.example.MyClass.method1', 'com.example.b'),
        createResolvedCall('com.example.MyClass.method2', 'com.example.c'),
      ]
    );
    const stats = getResolutionStats([file]);
    expect(stats.totalCalls).toBe(3);
    expect(stats.resolvedCalls).toBe(3);
    expect(stats.unresolvedCalls).toBe(0);
    expect(stats.resolutionRate).toBe(1);
  });

  it('should aggregate stats across multiple files', () => {
    const file1 = createResolvedFile(
      [createFunction('foo', [createCall('x'), createCall('y')])],
      [],
      [createResolvedCall('pkg1.foo', 'pkg1.x')]
    );
    const file2 = createResolvedFile(
      [createFunction('bar', [createCall('z')])],
      [],
      [createResolvedCall('pkg2.bar', 'pkg2.z')]
    );
    const stats = getResolutionStats([file1, file2]);
    expect(stats.totalCalls).toBe(3);
    expect(stats.resolvedCalls).toBe(2);
    expect(stats.unresolvedCalls).toBe(1);
    expect(stats.resolutionRate).toBeCloseTo(0.667, 2);
  });

  it('should handle mix of top-level and class functions', () => {
    const cls = createClass('Service', [createFunction('serve', [createCall('a')])]);
    const file = createResolvedFile(
      [createFunction('init', [createCall('b'), createCall('c')])],
      [cls],
      [
        createResolvedCall('com.example.init', 'com.example.b'),
        createResolvedCall('com.example.Service.serve', 'com.example.a'),
      ]
    );
    const stats = getResolutionStats([file]);
    expect(stats.totalCalls).toBe(3);
    expect(stats.resolvedCalls).toBe(2);
    expect(stats.unresolvedCalls).toBe(1);
  });
});
