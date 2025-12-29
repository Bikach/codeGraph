/**
 * Tests for Java return type extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractReturnType } from './extract-return-type.js';

/**
 * Helper to get the first method from parsed Java code.
 */
function getFirstMethod(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  return findChildByType(classBody!, 'method_declaration');
}

describe('extractReturnType', () => {
  describe('void return type', () => {
    it('should return undefined for void method', () => {
      const method = getFirstMethod('class Foo { void bar() {} }');
      expect(extractReturnType(method!)).toBeUndefined();
    });
  });

  describe('primitive return types', () => {
    it('should extract int return type', () => {
      const method = getFirstMethod('class Foo { int bar() { return 0; } }');
      expect(extractReturnType(method!)).toBe('int');
    });

    it('should extract boolean return type', () => {
      const method = getFirstMethod('class Foo { boolean bar() { return true; } }');
      expect(extractReturnType(method!)).toBe('boolean');
    });

    it('should extract double return type', () => {
      const method = getFirstMethod('class Foo { double bar() { return 0.0; } }');
      expect(extractReturnType(method!)).toBe('double');
    });
  });

  describe('reference return types', () => {
    it('should extract String return type', () => {
      const method = getFirstMethod('class Foo { String bar() { return ""; } }');
      expect(extractReturnType(method!)).toBe('String');
    });

    it('should extract custom class return type', () => {
      const method = getFirstMethod('class Foo { User bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('User');
    });
  });

  describe('generic return types', () => {
    it('should extract generic return type', () => {
      const method = getFirstMethod('class Foo { List<String> bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('List<String>');
    });

    it('should extract nested generic return type', () => {
      const method = getFirstMethod('class Foo { Map<String, List<Integer>> bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('Map<String, List<Integer>>');
    });
  });

  describe('array return types', () => {
    it('should extract array return type', () => {
      const method = getFirstMethod('class Foo { int[] bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('int[]');
    });

    it('should extract 2D array return type', () => {
      const method = getFirstMethod('class Foo { int[][] bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('int[][]');
    });

    it('should extract String array return type', () => {
      const method = getFirstMethod('class Foo { String[] bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('String[]');
    });
  });

  describe('qualified return types', () => {
    it('should extract fully qualified return type', () => {
      const method = getFirstMethod('class Foo { java.util.List bar() { return null; } }');
      expect(extractReturnType(method!)).toBe('java.util.List');
    });
  });
});
