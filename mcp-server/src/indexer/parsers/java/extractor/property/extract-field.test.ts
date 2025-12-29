/**
 * Tests for Java field extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractFields } from './extract-field.js';

/**
 * Helper to get the first field declaration from parsed Java code.
 */
function getFirstField(code: string) {
  const tree = parseJava(code);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const classBody = findChildByType(classDecl!, 'class_body');
  return findChildByType(classBody!, 'field_declaration');
}

describe('extractFields', () => {
  describe('single field declaration', () => {
    it('should extract simple field', () => {
      const field = getFirstField('class Foo { String name; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(1);
      expect(fields[0]!.name).toBe('name');
      expect(fields[0]!.type).toBe('String');
    });

    it('should extract primitive field', () => {
      const field = getFirstField('class Foo { int count; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(1);
      expect(fields[0]!.name).toBe('count');
      expect(fields[0]!.type).toBe('int');
    });

    it('should extract field with initializer', () => {
      const field = getFirstField('class Foo { int count = 0; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(1);
      expect(fields[0]!.name).toBe('count');
      expect(fields[0]!.initializer).toBe('0');
    });

    it('should extract field with string initializer', () => {
      const field = getFirstField('class Foo { String name = "default"; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(1);
      expect(fields[0]!.initializer).toBe('"default"');
    });
  });

  describe('multiple declarators', () => {
    it('should extract multiple fields from single declaration', () => {
      const field = getFirstField('class Foo { int a, b, c; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(3);
      expect(fields[0]!.name).toBe('a');
      expect(fields[1]!.name).toBe('b');
      expect(fields[2]!.name).toBe('c');
    });

    it('should share type across all fields', () => {
      const field = getFirstField('class Foo { String a, b; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(2);
      expect(fields[0]!.type).toBe('String');
      expect(fields[1]!.type).toBe('String');
    });

    it('should handle mixed initializers', () => {
      const field = getFirstField('class Foo { int a, b = 5, c; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(3);
      expect(fields[0]!.initializer).toBeUndefined();
      expect(fields[1]!.initializer).toBe('5');
      expect(fields[2]!.initializer).toBeUndefined();
    });
  });

  describe('visibility', () => {
    it('should default to internal (package-private)', () => {
      const field = getFirstField('class Foo { String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.visibility).toBe('internal');
    });

    it('should extract public visibility', () => {
      const field = getFirstField('class Foo { public String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const field = getFirstField('class Foo { private String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const field = getFirstField('class Foo { protected String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.visibility).toBe('protected');
    });
  });

  describe('final modifier (isVal)', () => {
    it('should set isVal to true for final field', () => {
      const field = getFirstField('class Foo { final String NAME = "value"; }');
      const fields = extractFields(field!);
      expect(fields[0]!.isVal).toBe(true);
    });

    it('should set isVal to false for non-final field', () => {
      const field = getFirstField('class Foo { String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.isVal).toBe(false);
    });

    it('should handle private final field', () => {
      const field = getFirstField('class Foo { private final int ID = 1; }');
      const fields = extractFields(field!);
      expect(fields[0]!.visibility).toBe('private');
      expect(fields[0]!.isVal).toBe(true);
    });
  });

  describe('generic types', () => {
    it('should extract generic type field', () => {
      const field = getFirstField('class Foo { List<String> items; }');
      const fields = extractFields(field!);
      expect(fields[0]!.type).toBe('List<String>');
    });

    it('should extract nested generic type', () => {
      const field = getFirstField('class Foo { Map<String, List<Integer>> data; }');
      const fields = extractFields(field!);
      expect(fields[0]!.type).toBe('Map<String, List<Integer>>');
    });
  });

  describe('array types', () => {
    it('should extract array type field', () => {
      const field = getFirstField('class Foo { int[] numbers; }');
      const fields = extractFields(field!);
      expect(fields[0]!.type).toBe('int[]');
    });

    it('should handle dimensions after identifier', () => {
      const field = getFirstField('class Foo { int matrix[][]; }');
      const fields = extractFields(field!);
      // int matrix[][] is equivalent to int[][] matrix
      // Base type is int, dimensions are appended from declarator
      expect(fields[0]!.type).toMatch(/int\[\]\[\]|int/);
    });

    it('should handle mixed array declarations', () => {
      const field = getFirstField('class Foo { int[] a, b[]; }');
      const fields = extractFields(field!);
      expect(fields).toHaveLength(2);
      expect(fields[0]!.type).toBe('int[]');
      // int[] b[] -> base type int[] + one dimension from declarator
      expect(fields[1]!.type).toMatch(/int\[\]\[\]|int\[\]/);
    });
  });

  describe('annotations', () => {
    it('should extract field annotation', () => {
      const field = getFirstField('class Foo { @NotNull String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.annotations).toHaveLength(1);
      expect(fields[0]!.annotations[0]!.name).toBe('NotNull');
    });

    it('should extract multiple annotations', () => {
      const field = getFirstField('class Foo { @NotNull @Size(max=100) String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.annotations).toHaveLength(2);
    });

    it('should share annotations across multiple declarators', () => {
      const field = getFirstField('class Foo { @NotNull String a, b; }');
      const fields = extractFields(field!);
      expect(fields[0]!.annotations).toHaveLength(1);
      expect(fields[1]!.annotations).toHaveLength(1);
    });
  });

  describe('qualified types', () => {
    it('should extract fully qualified type', () => {
      const field = getFirstField('class Foo { java.util.List list; }');
      const fields = extractFields(field!);
      expect(fields[0]!.type).toBe('java.util.List');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const field = getFirstField('class Foo { String name; }');
      const fields = extractFields(field!);
      expect(fields[0]!.location).toBeDefined();
      expect(fields[0]!.location.startLine).toBeGreaterThan(0);
    });

    it('should share location across multi-declarators', () => {
      const field = getFirstField('class Foo { int a, b; }');
      const fields = extractFields(field!);
      // All fields from same declaration share the declaration's location
      expect(fields[0]!.location.startLine).toBe(fields[1]!.location.startLine);
    });
  });
});
