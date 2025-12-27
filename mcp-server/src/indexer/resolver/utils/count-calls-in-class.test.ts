import { describe, it, expect } from 'vitest';
import { countCallsInClass } from './count-calls-in-class.js';
import type { ParsedClass, ParsedFunction, ParsedCall } from '../../types.js';

function createCall(name: string): ParsedCall {
  return {
    name,
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

function createClass(
  name: string,
  functions: ParsedFunction[] = [],
  nestedClasses: ParsedClass[] = [],
  companionObject?: ParsedClass['companionObject']
): ParsedClass {
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
    nestedClasses,
    annotations: [],
    companionObject,
    isAbstract: false,
    isData: false,
    isSealed: false,
  };
}

describe('countCallsInClass', () => {
  it('should return 0 for class with no functions', () => {
    const cls = createClass('Empty');
    expect(countCallsInClass(cls)).toBe(0);
  });

  it('should count calls in a single function', () => {
    const cls = createClass('Single', [
      createFunction('foo', [createCall('bar'), createCall('baz')]),
    ]);
    expect(countCallsInClass(cls)).toBe(2);
  });

  it('should count calls across multiple functions', () => {
    const cls = createClass('Multiple', [
      createFunction('foo', [createCall('a'), createCall('b')]),
      createFunction('bar', [createCall('c')]),
      createFunction('baz', [createCall('d'), createCall('e'), createCall('f')]),
    ]);
    expect(countCallsInClass(cls)).toBe(6);
  });

  it('should count calls in nested classes', () => {
    const nested = createClass('Nested', [
      createFunction('nestedFn', [createCall('x'), createCall('y')]),
    ]);
    const cls = createClass('Outer', [createFunction('outerFn', [createCall('z')])], [nested]);
    expect(countCallsInClass(cls)).toBe(3);
  });

  it('should count calls in deeply nested classes', () => {
    const deepNested = createClass('DeepNested', [
      createFunction('deepFn', [createCall('deep')]),
    ]);
    const nested = createClass('Nested', [createFunction('nestedFn', [createCall('mid')])], [
      deepNested,
    ]);
    const cls = createClass('Outer', [createFunction('outerFn', [createCall('top')])], [nested]);
    expect(countCallsInClass(cls)).toBe(3);
  });

  it('should count calls in companion object', () => {
    const companion = createClass('Companion', [
      createFunction('companionFn', [createCall('a'), createCall('b')]),
    ]);
    const cls = createClass(
      'WithCompanion',
      [createFunction('instanceFn', [createCall('c')])],
      [],
      companion
    );
    expect(countCallsInClass(cls)).toBe(3);
  });

  it('should handle class with no calls in any function', () => {
    const cls = createClass('NoCalls', [
      createFunction('foo'),
      createFunction('bar'),
    ]);
    expect(countCallsInClass(cls)).toBe(0);
  });
});
