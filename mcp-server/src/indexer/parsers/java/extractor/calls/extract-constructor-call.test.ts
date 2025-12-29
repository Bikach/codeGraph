/**
 * Tests for Java constructor call (object creation) extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractConstructorCall } from './extract-constructor-call.js';

/**
 * Helper to find all object_creation_expression nodes in parsed Java code.
 */
function findConstructorCalls(code: string) {
  const tree = parseJava(code);
  const calls: ReturnType<typeof extractConstructorCall>[] = [];

  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'object_creation_expression') {
      calls.push(extractConstructorCall(node));
    }
  });

  return calls.filter((c) => c !== undefined);
}

/**
 * Helper to get the first constructor call.
 */
function getFirstConstructorCall(code: string) {
  const calls = findConstructorCalls(code);
  return calls[0];
}

describe('extractConstructorCall', () => {
  describe('simple constructor calls', () => {
    it('should extract simple constructor call', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User(); } }');
      expect(call?.name).toBe('User');
      expect(call?.isConstructorCall).toBe(true);
    });

    it('should extract constructor with arguments', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User("name", 25); } }');
      expect(call?.name).toBe('User');
      expect(call?.argumentCount).toBe(2);
      expect(call?.isConstructorCall).toBe(true);
    });

    it('should extract constructor with no arguments', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new ArrayList(); } }');
      expect(call?.name).toBe('ArrayList');
      expect(call?.argumentCount).toBe(0);
    });
  });

  describe('generic constructor calls', () => {
    it('should extract generic type (base name only)', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new ArrayList<String>(); } }');
      expect(call?.name).toBe('ArrayList');
      expect(call?.isConstructorCall).toBe(true);
    });

    it('should extract nested generic type', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new HashMap<String, List<Integer>>(); } }');
      expect(call?.name).toBe('HashMap');
    });
  });

  describe('qualified constructor calls', () => {
    it('should extract fully qualified type', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new java.util.ArrayList(); } }');
      expect(call?.name).toBe('java.util.ArrayList');
      expect(call?.isConstructorCall).toBe(true);
    });

    it('should extract nested class constructor', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new Outer.Inner(); } }');
      expect(call?.name).toBe('Outer.Inner');
    });
  });

  describe('no receiver', () => {
    it('should have undefined receiver', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User(); } }');
      expect(call?.receiver).toBeUndefined();
    });
  });

  describe('argument counting', () => {
    it('should count zero arguments', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User(); } }');
      expect(call?.argumentCount).toBe(0);
    });

    it('should count multiple arguments', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User("a", "b", "c"); } }');
      expect(call?.argumentCount).toBe(3);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const call = getFirstConstructorCall('class Foo { void bar() { new User(); } }');
      expect(call?.location).toBeDefined();
      expect(call?.location.startLine).toBeGreaterThan(0);
    });
  });

  describe('anonymous classes', () => {
    it('should extract anonymous class constructor', () => {
      const call = getFirstConstructorCall(`
        class Foo {
          void bar() {
            new Runnable() {
              public void run() {}
            };
          }
        }
      `);
      expect(call?.name).toBe('Runnable');
      expect(call?.isConstructorCall).toBe(true);
    });
  });
});
