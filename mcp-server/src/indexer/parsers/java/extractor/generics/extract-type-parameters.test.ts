/**
 * Tests for extractTypeParameters
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractTypeParameters } from './extract-type-parameters.js';

/**
 * Helper to get a class declaration node from Java source.
 */
function getClassDeclaration(source: string) {
  const tree = parseJava(source);
  return findChildByType(tree.rootNode, 'class_declaration');
}

/**
 * Helper to get an interface declaration node from Java source.
 */
function getInterfaceDeclaration(source: string) {
  const tree = parseJava(source);
  return findChildByType(tree.rootNode, 'interface_declaration');
}

describe('extractTypeParameters', () => {
  describe('no type parameters', () => {
    it('should return empty array for class without generics', () => {
      const node = getClassDeclaration('class Foo {}');
      const result = extractTypeParameters(node!);
      expect(result).toEqual([]);
    });

    it('should return empty array for interface without generics', () => {
      const node = getInterfaceDeclaration('interface Foo {}');
      const result = extractTypeParameters(node!);
      expect(result).toEqual([]);
    });
  });

  describe('single type parameter', () => {
    it('should extract single unbounded type parameter', () => {
      const node = getClassDeclaration('class Box<T> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'T',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract single bounded type parameter', () => {
      const node = getClassDeclaration('class NumberBox<T extends Number> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'T',
        bounds: ['Number'],
        variance: undefined,
        isReified: undefined,
      });
    });
  });

  describe('multiple type parameters', () => {
    it('should extract two unbounded type parameters', () => {
      const node = getClassDeclaration('class Pair<K, V> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'K',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
      expect(result[1]).toEqual({
        name: 'V',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract three type parameters', () => {
      const node = getClassDeclaration('class Triple<A, B, C> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    });

    it('should extract mixed bounded and unbounded parameters', () => {
      const node = getClassDeclaration('class Map<K extends Comparable<K>, V> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'K',
        bounds: ['Comparable<K>'],
        variance: undefined,
        isReified: undefined,
      });
      expect(result[1]).toEqual({
        name: 'V',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
    });
  });

  describe('interfaces', () => {
    it('should extract type parameters from interface', () => {
      const node = getInterfaceDeclaration('interface Comparable<T> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('T');
    });

    it('should extract recursive bound from interface', () => {
      const node = getInterfaceDeclaration('interface Comparable<T extends Comparable<T>> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(1);
      expect(result[0]!).toEqual({
        name: 'T',
        bounds: ['Comparable<T>'],
        variance: undefined,
        isReified: undefined,
      });
    });
  });

  describe('complex bounds', () => {
    it('should extract intersection bounds', () => {
      const node = getClassDeclaration('class MyClass<T extends Serializable & Comparable<T>> {}');
      const result = extractTypeParameters(node!);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('T');
      expect(result[0]!.bounds).toContain('Serializable');
      expect(result[0]!.bounds).toContain('Comparable<T>');
    });
  });
});
