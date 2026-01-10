import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractTypeParameters, extractTypeParametersFromNode } from './extract-type-parameters.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract type parameters from a class declaration.
 */
function parseClassTypeParams(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  return extractTypeParameters(classNode);
}

/**
 * Helper to parse and extract type parameters from an interface declaration.
 */
function parseInterfaceTypeParams(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const interfaceNode = findChildByType(tree.rootNode, 'interface_declaration');
  if (!interfaceNode) throw new Error('No interface found');
  return extractTypeParameters(interfaceNode);
}

/**
 * Helper to parse and extract type parameters from a function declaration.
 */
function parseFunctionTypeParams(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const funcNode = findChildByType(tree.rootNode, 'function_declaration');
  if (!funcNode) throw new Error('No function found');
  return extractTypeParameters(funcNode);
}

describe('extractTypeParameters', () => {
  describe('single type parameter', () => {
    it('should extract single type parameter from class', () => {
      const params = parseClassTypeParams(`class Box<T> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
      expect(params[0]!.bounds).toBeUndefined();
    });

    it('should extract single type parameter from interface', () => {
      const params = parseInterfaceTypeParams(`interface Container<T> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
    });

    it('should extract single type parameter from function', () => {
      const params = parseFunctionTypeParams(`function identity<T>(x: T): T { return x; }`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
    });
  });

  describe('multiple type parameters', () => {
    it('should extract multiple type parameters', () => {
      const params = parseClassTypeParams(`class Pair<K, V> {}`);

      expect(params).toHaveLength(2);
      expect(params[0]!.name).toBe('K');
      expect(params[1]!.name).toBe('V');
    });

    it('should extract three type parameters', () => {
      const params = parseClassTypeParams(`class Triple<A, B, C> {}`);

      expect(params).toHaveLength(3);
      expect(params.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    });

    it('should extract function with multiple type parameters', () => {
      const params = parseFunctionTypeParams(`function map<T, U>(arr: T[], fn: (x: T) => U): U[] { return []; }`);

      expect(params).toHaveLength(2);
      expect(params[0]!.name).toBe('T');
      expect(params[1]!.name).toBe('U');
    });
  });

  describe('type parameter constraints', () => {
    it('should extract type parameter with extends constraint', () => {
      const params = parseClassTypeParams(`class NumberBox<T extends number> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
      expect(params[0]!.bounds).toContain('number');
    });

    it('should extract type parameter with interface constraint', () => {
      const params = parseClassTypeParams(`class Repository<T extends Entity> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
      expect(params[0]!.bounds).toContain('Entity');
    });

    it('should extract type parameter with generic constraint', () => {
      const params = parseInterfaceTypeParams(`interface Comparable<T extends Comparable<T>> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.name).toBe('T');
      expect(params[0]!.bounds).toBeDefined();
      expect(params[0]!.bounds![0]).toContain('Comparable');
    });

    it('should extract type parameter with object constraint', () => {
      const params = parseFunctionTypeParams(`function keys<T extends object>(obj: T): string[] { return []; }`);

      expect(params).toHaveLength(1);
      expect(params[0]!.bounds).toContain('object');
    });
  });

  describe('no type parameters', () => {
    it('should return empty array for class without generics', () => {
      const params = parseClassTypeParams(`class Simple {}`);

      expect(params).toHaveLength(0);
    });

    it('should return empty array for interface without generics', () => {
      const params = parseInterfaceTypeParams(`interface Plain {}`);

      expect(params).toHaveLength(0);
    });

    it('should return empty array for function without generics', () => {
      const params = parseFunctionTypeParams(`function add(a: number, b: number): number { return a + b; }`);

      expect(params).toHaveLength(0);
    });
  });

  describe('extractTypeParametersFromNode', () => {
    it('should extract from type_parameters node directly', () => {
      const tree = parseTypeScript(`class Box<T, U> {}`, '/test.ts');
      const classNode = findChildByType(tree.rootNode, 'class_declaration');
      const typeParamsNode = findChildByType(classNode!, 'type_parameters');

      if (!typeParamsNode) throw new Error('No type_parameters node');

      const params = extractTypeParametersFromNode(typeParamsNode);

      expect(params).toHaveLength(2);
      expect(params[0]!.name).toBe('T');
      expect(params[1]!.name).toBe('U');
    });
  });

  describe('edge cases', () => {
    it('should handle single letter type parameters', () => {
      const params = parseClassTypeParams(`class Map<K, V> {}`);

      expect(params.map((p) => p.name)).toEqual(['K', 'V']);
    });

    it('should handle descriptive type parameter names', () => {
      const params = parseClassTypeParams(`class Container<TItem, TKey> {}`);

      expect(params.map((p) => p.name)).toEqual(['TItem', 'TKey']);
    });

    it('should handle type parameter with union constraint', () => {
      const params = parseClassTypeParams(`class Handler<T extends string | number> {}`);

      expect(params).toHaveLength(1);
      expect(params[0]!.bounds).toBeDefined();
    });
  });
});
