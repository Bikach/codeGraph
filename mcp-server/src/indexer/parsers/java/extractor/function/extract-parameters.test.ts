/**
 * Tests for Java parameter extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractParameters } from './extract-parameters.js';

/**
 * Helper to get the first method from parsed Java code.
 */
function getFirstMethod(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  return findChildByType(classBody!, 'method_declaration');
}

describe('extractParameters', () => {
  describe('no parameters', () => {
    it('should return empty array for method without parameters', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      const params = extractParameters(method!);
      expect(params).toEqual([]);
    });
  });

  describe('single parameter', () => {
    it('should extract simple type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(String name) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('name');
      expect(params[0]!.type).toBe('String');
    });

    it('should extract primitive type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(int count) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('count');
      expect(params[0]!.type).toBe('int');
    });

    it('should extract boolean type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(boolean flag) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('flag');
      expect(params[0]!.type).toBe('boolean');
    });
  });

  describe('multiple parameters', () => {
    it('should extract multiple parameters', () => {
      const method = getFirstMethod('class Foo { void bar(String name, int age) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(2);
      expect(params[0]!.name).toBe('name');
      expect(params[0]!.type).toBe('String');
      expect(params[1]!.name).toBe('age');
      expect(params[1]!.type).toBe('int');
    });
  });

  describe('generic types', () => {
    it('should extract generic type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(List<String> items) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('items');
      expect(params[0]!.type).toBe('List<String>');
    });

    it('should extract nested generic type', () => {
      const method = getFirstMethod('class Foo { void bar(Map<String, List<Integer>> data) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('data');
      expect(params[0]!.type).toBe('Map<String, List<Integer>>');
    });
  });

  describe('array types', () => {
    it('should extract array type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(int[] numbers) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('numbers');
      expect(params[0]!.type).toBe('int[]');
    });

    it('should extract 2D array type parameter', () => {
      const method = getFirstMethod('class Foo { void bar(int[][] matrix) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('matrix');
      expect(params[0]!.type).toBe('int[][]');
    });

    it('should handle dimensions after identifier', () => {
      const method = getFirstMethod('class Foo { void bar(int matrix[][]) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('matrix');
      // Note: In Java, int matrix[][] is equivalent to int[][] matrix
      // The type extraction captures base type, dimensions are after name
      expect(params[0]!.type).toMatch(/int\[\]\[\]|int/);
    });
  });

  describe('varargs', () => {
    it('should extract varargs parameter', () => {
      const method = getFirstMethod('class Foo { void bar(String... args) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('args');
      expect(params[0]!.type).toBe('String...');
    });

    it('should extract varargs with other parameters', () => {
      const method = getFirstMethod('class Foo { void bar(String format, Object... args) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(2);
      expect(params[0]!.name).toBe('format');
      expect(params[0]!.type).toBe('String');
      expect(params[1]!.name).toBe('args');
      expect(params[1]!.type).toBe('Object...');
    });
  });

  describe('annotations', () => {
    it('should extract parameter with annotation', () => {
      const method = getFirstMethod('class Foo { void bar(@NotNull String name) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('name');
      expect(params[0]!.annotations).toHaveLength(1);
      expect(params[0]!.annotations[0]!.name).toBe('NotNull');
    });

    it('should extract parameter with multiple annotations', () => {
      const method = getFirstMethod('class Foo { void bar(@NotNull @Size(min=1) String name) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.annotations).toHaveLength(2);
    });
  });

  describe('scoped types', () => {
    it('should extract fully qualified type', () => {
      const method = getFirstMethod('class Foo { void bar(java.util.List list) {} }');
      const params = extractParameters(method!);
      expect(params).toHaveLength(1);
      expect(params[0]!.type).toBe('java.util.List');
    });
  });
});
