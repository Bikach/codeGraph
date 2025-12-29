/**
 * Tests for Java record component extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractRecordComponents } from './extract-record-components.js';

/**
 * Helper to get the record_declaration node from parsed Java code.
 */
function getRecordDeclaration(code: string) {
  const tree = parseJava(code);
  return findChildByType(tree.rootNode, 'record_declaration');
}

describe('extractRecordComponents', () => {
  describe('basic components', () => {
    it('should extract simple record components', () => {
      const node = getRecordDeclaration('record Point(int x, int y) {}');
      const components = extractRecordComponents(node!);

      expect(components).toHaveLength(2);
      expect(components[0].name).toBe('x');
      expect(components[0].type).toBe('int');
      expect(components[1].name).toBe('y');
      expect(components[1].type).toBe('int');
    });

    it('should mark components as immutable (isVal: true)', () => {
      const node = getRecordDeclaration('record User(String name) {}');
      const components = extractRecordComponents(node!);

      expect(components).toHaveLength(1);
      expect(components[0].isVal).toBe(true);
    });

    it('should mark components as private visibility', () => {
      const node = getRecordDeclaration('record User(String name) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].visibility).toBe('private');
    });

    it('should extract record with no components', () => {
      const node = getRecordDeclaration('record Empty() {}');
      const components = extractRecordComponents(node!);

      expect(components).toHaveLength(0);
    });
  });

  describe('type extraction', () => {
    it('should extract primitive types', () => {
      const node = getRecordDeclaration(
        'record Types(int a, long b, double c, boolean d) {}'
      );
      const components = extractRecordComponents(node!);

      expect(components.map((c) => c.type)).toEqual([
        'int',
        'long',
        'double',
        'boolean',
      ]);
    });

    it('should extract reference types', () => {
      const node = getRecordDeclaration('record User(String name, Integer age) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].type).toBe('String');
      expect(components[1].type).toBe('Integer');
    });

    it('should extract generic types', () => {
      const node = getRecordDeclaration('record Container(List<String> items) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].type).toBe('List<String>');
    });

    it('should extract nested generic types', () => {
      const node = getRecordDeclaration(
        'record Complex(Map<String, List<Integer>> data) {}'
      );
      const components = extractRecordComponents(node!);

      expect(components[0].type).toBe('Map<String, List<Integer>>');
    });

    it('should extract array types', () => {
      const node = getRecordDeclaration('record Data(int[] numbers, String[][] matrix) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].type).toBe('int[]');
      expect(components[1].type).toBe('String[][]');
    });

    it('should extract qualified types', () => {
      const node = getRecordDeclaration('record Config(java.util.Date date) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].type).toBe('java.util.Date');
    });
  });

  describe('location', () => {
    it('should include location for each component', () => {
      const node = getRecordDeclaration('record Point(int x, int y) {}');
      const components = extractRecordComponents(node!);

      expect(components[0].location).toBeDefined();
      expect(components[0].location.startLine).toBeGreaterThan(0);
      expect(components[1].location).toBeDefined();
    });
  });

  describe('non-record declarations', () => {
    it('should return empty array for class declaration', () => {
      const tree = parseJava('class Foo { }');
      const classNode = findChildByType(tree.rootNode, 'class_declaration');
      const components = extractRecordComponents(classNode!);

      expect(components).toHaveLength(0);
    });
  });
});
