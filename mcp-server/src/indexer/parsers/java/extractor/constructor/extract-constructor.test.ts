/**
 * Tests for Java constructor extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractConstructor } from './extract-constructor.js';

/**
 * Helper to get the first constructor from parsed Java code.
 */
function getFirstConstructor(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  return findChildByType(classBody!, 'constructor_declaration');
}

describe('extractConstructor', () => {
  describe('basic constructor', () => {
    it('should extract constructor without parameters', () => {
      const ctor = getFirstConstructor('class Foo { Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(0);
    });

    it('should extract constructor with single parameter', () => {
      const ctor = getFirstConstructor('class Foo { Foo(String name) {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.parameters[0]!.name).toBe('name');
      expect(parsed.parameters[0]!.type).toBe('String');
    });

    it('should extract constructor with multiple parameters', () => {
      const ctor = getFirstConstructor('class Foo { Foo(String name, int age) {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(2);
      expect(parsed.parameters[0]!.name).toBe('name');
      expect(parsed.parameters[1]!.name).toBe('age');
    });
  });

  describe('visibility', () => {
    it('should default to internal (package-private)', () => {
      const ctor = getFirstConstructor('class Foo { Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.visibility).toBe('internal');
    });

    it('should extract public visibility', () => {
      const ctor = getFirstConstructor('class Foo { public Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const ctor = getFirstConstructor('class Foo { private Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const ctor = getFirstConstructor('class Foo { protected Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.visibility).toBe('protected');
    });
  });

  describe('delegation (this/super)', () => {
    it('should detect this() delegation', () => {
      const code = `
        class Foo {
          Foo(String name) {}
          Foo() { this("default"); }
        }
      `;
      const tree = parseJava(code);
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const classBody = findChildByType(classDecl!, 'class_body');
      // Get second constructor
      const ctors = classBody!.children.filter((c) => c.type === 'constructor_declaration');
      const parsed = extractConstructor(ctors[1]!);
      expect(parsed.delegatesTo).toBe('this');
    });

    it('should detect super() delegation', () => {
      const code = `
        class Foo extends Bar {
          Foo(String name) { super(name); }
        }
      `;
      const ctor = getFirstConstructor(code);
      const parsed = extractConstructor(ctor!);
      expect(parsed.delegatesTo).toBe('super');
    });

    it('should return undefined for no delegation', () => {
      const ctor = getFirstConstructor('class Foo { Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.delegatesTo).toBeUndefined();
    });
  });

  describe('annotations', () => {
    it('should extract constructor annotation', () => {
      const ctor = getFirstConstructor('class Foo { @Deprecated Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.annotations).toHaveLength(1);
      expect(parsed.annotations[0]!.name).toBe('Deprecated');
    });

    it('should extract multiple annotations', () => {
      const ctor = getFirstConstructor('class Foo { @Deprecated @SuppressWarnings("unused") Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.annotations).toHaveLength(2);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const ctor = getFirstConstructor('class Foo { Foo() {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.location).toBeDefined();
      expect(parsed.location.startLine).toBeGreaterThan(0);
      expect(parsed.location.endLine).toBeGreaterThanOrEqual(parsed.location.startLine);
    });
  });

  describe('parameter annotations', () => {
    it('should extract parameter annotations', () => {
      const ctor = getFirstConstructor('class Foo { Foo(@NotNull String name) {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.parameters[0]!.annotations).toHaveLength(1);
      expect(parsed.parameters[0]!.annotations[0]!.name).toBe('NotNull');
    });
  });

  describe('generic parameters', () => {
    it('should extract generic type parameters', () => {
      const ctor = getFirstConstructor('class Foo { Foo(List<String> items) {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.parameters[0]!.type).toBe('List<String>');
    });
  });

  describe('varargs', () => {
    it('should extract varargs parameter', () => {
      const ctor = getFirstConstructor('class Foo { Foo(String... args) {} }');
      const parsed = extractConstructor(ctor!);
      expect(parsed.parameters).toHaveLength(1);
      expect(parsed.parameters[0]!.type).toBe('String...');
    });
  });
});
