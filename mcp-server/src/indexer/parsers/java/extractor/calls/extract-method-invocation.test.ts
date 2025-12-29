/**
 * Tests for Java method invocation extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType, traverseNode } from '../ast-utils/index.js';
import { extractMethodInvocation } from './extract-method-invocation.js';

/**
 * Helper to find all method_invocation nodes in parsed Java code.
 */
function findMethodInvocations(code: string) {
  const tree = parseJava(code);
  const invocations: ReturnType<typeof extractMethodInvocation>[] = [];

  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'method_invocation') {
      invocations.push(extractMethodInvocation(node));
    }
  });

  return invocations.filter((i) => i !== undefined);
}

/**
 * Helper to get the first method invocation.
 */
function getFirstInvocation(code: string) {
  const invocations = findMethodInvocations(code);
  return invocations[0];
}

describe('extractMethodInvocation', () => {
  describe('direct calls (no receiver)', () => {
    it('should extract direct method call', () => {
      const call = getFirstInvocation('class Foo { void bar() { calculate(); } }');
      expect(call?.name).toBe('calculate');
      expect(call?.receiver).toBeUndefined();
    });

    it('should extract call with arguments', () => {
      const call = getFirstInvocation('class Foo { void bar() { calculate(1, 2, 3); } }');
      expect(call?.name).toBe('calculate');
      expect(call?.argumentCount).toBe(3);
    });

    it('should extract call with no arguments', () => {
      const call = getFirstInvocation('class Foo { void bar() { doSomething(); } }');
      expect(call?.name).toBe('doSomething');
      expect(call?.argumentCount).toBe(0);
    });
  });

  describe('qualified calls (with receiver)', () => {
    it('should extract simple receiver', () => {
      const call = getFirstInvocation('class Foo { void bar() { obj.method(); } }');
      expect(call?.name).toBe('method');
      expect(call?.receiver).toBe('obj');
    });

    it('should extract field access receiver', () => {
      const call = getFirstInvocation('class Foo { void bar() { System.out.println("hi"); } }');
      expect(call?.name).toBe('println');
      expect(call?.receiver).toBe('System.out');
      expect(call?.argumentCount).toBe(1);
    });

    it('should extract this receiver', () => {
      const call = getFirstInvocation('class Foo { void bar() { this.helper(); } }');
      expect(call?.name).toBe('helper');
      expect(call?.receiver).toBe('this');
    });

    it('should extract super receiver', () => {
      const call = getFirstInvocation('class Foo { void bar() { super.onCreate(); } }');
      expect(call?.name).toBe('onCreate');
      expect(call?.receiver).toBe('super');
    });
  });

  describe('chained calls', () => {
    it('should extract final method in chain', () => {
      const calls = findMethodInvocations('class Foo { void bar() { a.b().c(); } }');
      // Should find 3 calls: a.b(), a.b().c() chained
      expect(calls.length).toBeGreaterThanOrEqual(1);

      // The outermost call is c()
      const outermost = calls.find((c) => c?.name === 'c');
      expect(outermost).toBeDefined();
      expect(outermost?.name).toBe('c');
    });

    it('should extract all calls in chain', () => {
      const calls = findMethodInvocations('class Foo { void bar() { builder.name("x").age(25).build(); } }');
      expect(calls.length).toBe(3);

      const names = calls.map((c) => c?.name);
      expect(names).toContain('name');
      expect(names).toContain('age');
      expect(names).toContain('build');
    });
  });

  describe('static method calls', () => {
    it('should extract static method call', () => {
      const call = getFirstInvocation('class Foo { void bar() { Math.abs(-5); } }');
      expect(call?.name).toBe('abs');
      expect(call?.receiver).toBe('Math');
    });

    it('should extract qualified static call', () => {
      const call = getFirstInvocation('class Foo { void bar() { java.lang.Math.max(1, 2); } }');
      expect(call?.name).toBe('max');
      expect(call?.receiver).toBe('java.lang.Math');
      expect(call?.argumentCount).toBe(2);
    });
  });

  describe('argument counting', () => {
    it('should count zero arguments', () => {
      const call = getFirstInvocation('class Foo { void bar() { method(); } }');
      expect(call?.argumentCount).toBe(0);
    });

    it('should count single argument', () => {
      const call = getFirstInvocation('class Foo { void bar() { method("hello"); } }');
      expect(call?.argumentCount).toBe(1);
    });

    it('should count multiple arguments', () => {
      const call = getFirstInvocation('class Foo { void bar() { method(1, "two", 3.0, true); } }');
      expect(call?.argumentCount).toBe(4);
    });

    it('should count nested call as single argument', () => {
      const calls = findMethodInvocations('class Foo { void bar() { outer(inner()); } }');
      const outer = calls.find((c) => c?.name === 'outer');
      expect(outer?.argumentCount).toBe(1);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const call = getFirstInvocation('class Foo { void bar() { method(); } }');
      expect(call?.location).toBeDefined();
      expect(call?.location.startLine).toBeGreaterThan(0);
    });
  });

  describe('isSafeCall', () => {
    it('should always be false (Java has no safe calls)', () => {
      const call = getFirstInvocation('class Foo { void bar() { obj.method(); } }');
      expect(call?.isSafeCall).toBe(false);
    });
  });
});
