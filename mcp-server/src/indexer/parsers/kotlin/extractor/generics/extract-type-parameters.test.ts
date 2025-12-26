import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractTypeParameters } from './extract-type-parameters.js';

function getTypeParams(code: string): ReturnType<typeof extractTypeParameters> {
  const tree = parseKotlin(code);
  const decl = tree.rootNode.children.find(
    (c) => c.type === 'class_declaration' || c.type === 'function_declaration'
  );
  return decl ? extractTypeParameters(decl) : [];
}

describe('extractTypeParameters', () => {
  it('should return empty array for class without type parameters', () => {
    const params = getTypeParams('class User');
    expect(params).toEqual([]);
  });

  it('should extract single type parameter', () => {
    const params = getTypeParams('class Box<T>');
    expect(params).toHaveLength(1);
    expect(params[0]!.name).toBe('T');
  });

  it('should extract multiple type parameters', () => {
    const params = getTypeParams('class Pair<A, B>');
    expect(params).toHaveLength(2);
    expect(params[0]!.name).toBe('A');
    expect(params[1]!.name).toBe('B');
  });

  it('should extract type parameters with bounds', () => {
    const params = getTypeParams('class NumberBox<T : Number>');
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual({
      name: 'T',
      bounds: ['Number'],
      variance: undefined,
      isReified: undefined,
    });
  });

  it('should extract type parameters with variance', () => {
    const params = getTypeParams('class Producer<out T>');
    expect(params).toHaveLength(1);
    expect(params[0]!.variance).toBe('out');
  });

  it('should extract function type parameters', () => {
    const params = getTypeParams('fun <T> identity(value: T): T = value');
    expect(params).toHaveLength(1);
    expect(params[0]!.name).toBe('T');
  });

  it('should extract function with multiple type parameters', () => {
    const params = getTypeParams('fun <K, V> mapOf(key: K, value: V): Map<K, V> = TODO()');
    expect(params).toHaveLength(2);
    expect(params[0]!.name).toBe('K');
    expect(params[1]!.name).toBe('V');
  });

  it('should handle where clause with single constraint', () => {
    const params = getTypeParams('class Sorter<T> where T : Comparable<T>');
    expect(params).toHaveLength(1);
    expect(params[0]!.name).toBe('T');
    expect(params[0]!.bounds).toContain('Comparable<T>');
  });

  it('should handle where clause with multiple constraints', () => {
    const params = getTypeParams(`
      class MultiConstraint<T> where T : CharSequence, T : Comparable<T>
    `);
    expect(params).toHaveLength(1);
    expect(params[0]!.name).toBe('T');
    expect(params[0]!.bounds).toContain('CharSequence');
    expect(params[0]!.bounds).toContain('Comparable<T>');
  });

  it('should merge inline bound with where clause bound', () => {
    const params = getTypeParams(`
      class MergedBounds<T : Number> where T : Comparable<T>
    `);
    expect(params).toHaveLength(1);
    expect(params[0]!.bounds).toContain('Number');
    expect(params[0]!.bounds).toContain('Comparable<T>');
  });

  it('should handle complex generic bounds', () => {
    const params = getTypeParams('class Container<T : List<String>>');
    expect(params).toHaveLength(1);
    expect(params[0]!.bounds).toEqual(['List<String>']);
  });

  it('should extract in variance with bound', () => {
    const params = getTypeParams('class Processor<in T : Any>');
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual({
      name: 'T',
      bounds: ['Any'],
      variance: 'in',
      isReified: undefined,
    });
  });
});
