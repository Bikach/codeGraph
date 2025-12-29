/**
 * Tests for Java method extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractMethod } from './extract-method.js';

/**
 * Helper to get the first method from parsed Java code.
 */
function getFirstMethod(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  return findChildByType(classBody!, 'method_declaration');
}

describe('extractMethod', () => {
  describe('basic method extraction', () => {
    it('should extract method name', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.name).toBe('bar');
    });

    it('should extract void return type as undefined', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.returnType).toBeUndefined();
    });

    it('should extract non-void return type', () => {
      const method = getFirstMethod('class Foo { String bar() { return ""; } }');
      const parsed = extractMethod(method!);
      expect(parsed.returnType).toBe('String');
    });
  });

  describe('visibility', () => {
    it('should default to internal (package-private)', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.visibility).toBe('internal');
    });

    it('should extract public visibility', () => {
      const method = getFirstMethod('class Foo { public void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const method = getFirstMethod('class Foo { private void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const method = getFirstMethod('class Foo { protected void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.visibility).toBe('protected');
    });
  });

  describe('modifiers', () => {
    it('should detect abstract method', () => {
      const method = getFirstMethod('abstract class Foo { abstract void bar(); }');
      const parsed = extractMethod(method!);
      expect(parsed.isAbstract).toBe(true);
    });

    it('should detect non-abstract method with body', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.isAbstract).toBe(false);
    });

    it('should set Java-specific modifiers to false', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.isSuspend).toBe(false);
      expect(parsed.isExtension).toBe(false);
      expect(parsed.isInline).toBe(false);
      expect(parsed.isInfix).toBe(false);
      expect(parsed.isOperator).toBe(false);
    });
  });

  describe('parameters', () => {
    it('should extract method without parameters', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.parameters).toHaveLength(0);
    });

    it('should extract method with single parameter', () => {
      const method = getFirstMethod('class Foo { void bar(String name) {} }');
      const parsed = extractMethod(method!);
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.parameters[0].name).toBe('name');
      expect(parsed.parameters[0].type).toBe('String');
    });

    it('should extract method with multiple parameters', () => {
      const method = getFirstMethod('class Foo { void bar(String name, int age) {} }');
      const parsed = extractMethod(method!);
      expect(parsed.parameters).toHaveLength(2);
    });
  });

  describe('type parameters (generics)', () => {
    it('should extract generic method', () => {
      const method = getFirstMethod('class Foo { <T> T bar(T item) { return item; } }');
      const parsed = extractMethod(method!);
      expect(parsed.typeParameters).toHaveLength(1);
      expect(parsed.typeParameters![0].name).toBe('T');
    });

    it('should extract bounded type parameter', () => {
      const method = getFirstMethod('class Foo { <T extends Number> T bar(T item) { return item; } }');
      const parsed = extractMethod(method!);
      expect(parsed.typeParameters).toHaveLength(1);
      expect(parsed.typeParameters![0].name).toBe('T');
      expect(parsed.typeParameters![0].bounds).toContain('Number');
    });

    it('should extract multiple type parameters', () => {
      const method = getFirstMethod('class Foo { <K, V> V bar(K key) { return null; } }');
      const parsed = extractMethod(method!);
      expect(parsed.typeParameters).toHaveLength(2);
      expect(parsed.typeParameters![0].name).toBe('K');
      expect(parsed.typeParameters![1].name).toBe('V');
    });
  });

  describe('annotations', () => {
    it('should extract method annotation', () => {
      const method = getFirstMethod('class Foo { @Override void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.annotations).toHaveLength(1);
      expect(parsed.annotations[0].name).toBe('Override');
    });

    it('should extract multiple annotations', () => {
      const method = getFirstMethod('class Foo { @Override @Deprecated void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.annotations).toHaveLength(2);
    });

    it('should extract annotation with arguments', () => {
      const method = getFirstMethod('class Foo { @SuppressWarnings("unchecked") void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.annotations).toHaveLength(1);
      expect(parsed.annotations[0].name).toBe('SuppressWarnings');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const parsed = extractMethod(method!);
      expect(parsed.location).toBeDefined();
      expect(parsed.location.startLine).toBeGreaterThan(0);
      expect(parsed.location.endLine).toBeGreaterThanOrEqual(parsed.location.startLine);
    });
  });

  describe('calls', () => {
    it('should extract method calls from body', () => {
      const method = getFirstMethod('class Foo { void bar() { System.out.println("test"); } }');
      const parsed = extractMethod(method!);
      expect(parsed.calls).toHaveLength(1);
      expect(parsed.calls[0].name).toBe('println');
      expect(parsed.calls[0].receiver).toBe('System.out');
    });

    it('should return empty calls for abstract method', () => {
      const method = getFirstMethod('abstract class Foo { abstract void bar(); }');
      const parsed = extractMethod(method!);
      expect(parsed.calls).toEqual([]);
    });

    it('should extract multiple calls', () => {
      const method = getFirstMethod(`
        class Foo {
          void bar() {
            User user = new User();
            user.save();
            log("done");
          }
        }
      `);
      const parsed = extractMethod(method!);
      expect(parsed.calls.length).toBeGreaterThanOrEqual(3);

      const names = parsed.calls.map((c) => c.name);
      expect(names).toContain('User'); // constructor
      expect(names).toContain('save');
      expect(names).toContain('log');
    });
  });

  describe('interface methods', () => {
    it('should extract interface method without body as abstract', () => {
      const code = 'interface Foo { void bar(); }';
      const tree = parseJava(code);
      const interfaceDecl = findChildByType(tree.rootNode, 'interface_declaration');
      const interfaceBody = findChildByType(interfaceDecl!, 'interface_body');
      const method = findChildByType(interfaceBody!, 'method_declaration');
      const parsed = extractMethod(method!);
      expect(parsed.name).toBe('bar');
      expect(parsed.isAbstract).toBe(true);
    });

    it('should extract default interface method', () => {
      const code = 'interface Foo { default void bar() {} }';
      const tree = parseJava(code);
      const interfaceDecl = findChildByType(tree.rootNode, 'interface_declaration');
      const interfaceBody = findChildByType(interfaceDecl!, 'interface_body');
      const method = findChildByType(interfaceBody!, 'method_declaration');
      const parsed = extractMethod(method!);
      expect(parsed.name).toBe('bar');
      expect(parsed.isAbstract).toBe(false); // has body
    });
  });
});
