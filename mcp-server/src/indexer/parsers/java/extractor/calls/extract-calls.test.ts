/**
 * Tests for Java call extraction (orchestration).
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractCalls } from './extract-calls.js';

/**
 * Helper to get the method body block from parsed Java code.
 */
function getMethodBody(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  const method = findChildByType(classBody!, 'method_declaration');
  return findChildByType(method!, 'block');
}

describe('extractCalls', () => {
  describe('method invocations', () => {
    it('should extract direct method calls', () => {
      const body = getMethodBody('class Foo { void bar() { doSomething(); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('doSomething');
      expect(calls[0].isConstructorCall).toBeUndefined();
    });

    it('should extract qualified method calls', () => {
      const body = getMethodBody('class Foo { void bar() { obj.method(); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('method');
      expect(calls[0].receiver).toBe('obj');
    });

    it('should extract multiple method calls', () => {
      const body = getMethodBody(`
        class Foo {
          void bar() {
            a();
            b();
            c();
          }
        }
      `);
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(3);
      expect(calls.map((c) => c.name)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('constructor calls', () => {
    it('should extract constructor calls', () => {
      const body = getMethodBody('class Foo { void bar() { new User(); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('User');
      expect(calls[0].isConstructorCall).toBe(true);
    });

    it('should extract constructor with arguments', () => {
      const body = getMethodBody('class Foo { void bar() { new User("name", 25); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].argumentCount).toBe(2);
    });
  });

  describe('mixed calls', () => {
    it('should extract both method and constructor calls', () => {
      const body = getMethodBody(`
        class Foo {
          void bar() {
            User user = new User("name");
            user.save();
            System.out.println("done");
          }
        }
      `);
      const calls = extractCalls(body!);

      expect(calls.length).toBeGreaterThanOrEqual(3);

      const constructorCall = calls.find((c) => c.isConstructorCall);
      expect(constructorCall?.name).toBe('User');

      const methodCalls = calls.filter((c) => !c.isConstructorCall);
      const methodNames = methodCalls.map((c) => c.name);
      expect(methodNames).toContain('save');
      expect(methodNames).toContain('println');
    });
  });

  describe('chained calls', () => {
    it('should extract all calls in a chain', () => {
      const body = getMethodBody('class Foo { void bar() { a.b().c().d(); } }');
      const calls = extractCalls(body!);

      // Should extract b(), c(), d() from the chain
      expect(calls.length).toBeGreaterThanOrEqual(3);
      const names = calls.map((c) => c.name);
      expect(names).toContain('b');
      expect(names).toContain('c');
      expect(names).toContain('d');
    });
  });

  describe('nested calls', () => {
    it('should extract nested calls', () => {
      const body = getMethodBody('class Foo { void bar() { outer(inner()); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(2);
      const names = calls.map((c) => c.name);
      expect(names).toContain('outer');
      expect(names).toContain('inner');
    });
  });

  describe('empty body', () => {
    it('should return empty array for empty method', () => {
      const body = getMethodBody('class Foo { void bar() {} }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(0);
    });
  });

  describe('calls with this/super', () => {
    it('should extract this.method() calls', () => {
      const body = getMethodBody('class Foo { void bar() { this.helper(); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('helper');
      expect(calls[0].receiver).toBe('this');
    });

    it('should extract super.method() calls', () => {
      const body = getMethodBody('class Foo { void bar() { super.onCreate(); } }');
      const calls = extractCalls(body!);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('onCreate');
      expect(calls[0].receiver).toBe('super');
    });
  });
});
