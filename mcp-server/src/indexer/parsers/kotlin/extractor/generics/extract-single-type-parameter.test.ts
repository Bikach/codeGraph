import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractSingleTypeParameter } from './extract-single-type-parameter.js';
import { findChildByType } from '../ast-utils/index.js';

function getTypeParameter(code: string): ReturnType<typeof extractSingleTypeParameter> {
  const tree = parseKotlin(code);
  const classDecl = tree.rootNode.children.find((c) => c.type === 'class_declaration');
  const typeParams = findChildByType(classDecl!, 'type_parameters');
  const typeParam = typeParams?.children.find((c) => c.type === 'type_parameter');
  return typeParam ? extractSingleTypeParameter(typeParam) : undefined;
}

describe('extractSingleTypeParameter', () => {
  it('should extract simple type parameter', () => {
    const param = getTypeParameter('class Box<T>');
    expect(param).toEqual({
      name: 'T',
      bounds: undefined,
      variance: undefined,
      isReified: undefined,
    });
  });

  it('should extract type parameter with upper bound', () => {
    const param = getTypeParameter('class Box<T : Number>');
    expect(param).toEqual({
      name: 'T',
      bounds: ['Number'],
      variance: undefined,
      isReified: undefined,
    });
  });

  it('should extract out variance modifier', () => {
    const param = getTypeParameter('class Producer<out T>');
    expect(param).toEqual({
      name: 'T',
      bounds: undefined,
      variance: 'out',
      isReified: undefined,
    });
  });

  it('should extract in variance modifier', () => {
    const param = getTypeParameter('class Consumer<in T>');
    expect(param).toEqual({
      name: 'T',
      bounds: undefined,
      variance: 'in',
      isReified: undefined,
    });
  });

  it('should extract out variance with bound', () => {
    const param = getTypeParameter('class Producer<out T : CharSequence>');
    expect(param).toEqual({
      name: 'T',
      bounds: ['CharSequence'],
      variance: 'out',
      isReified: undefined,
    });
  });

  it('should extract nullable bound', () => {
    const param = getTypeParameter('class Box<T : Any?>');
    expect(param).toEqual({
      name: 'T',
      bounds: ['Any?'],
      variance: undefined,
      isReified: undefined,
    });
  });

  it('should extract generic bound', () => {
    const param = getTypeParameter('class Box<T : Comparable<T>>');
    expect(param).toEqual({
      name: 'T',
      bounds: ['Comparable<T>'],
      variance: undefined,
      isReified: undefined,
    });
  });

  it('should return undefined for non type_parameter node', () => {
    // extractSingleTypeParameter expects a type_parameter node
    // When given a different node type, it may still find a type_identifier
    // but the function is designed for type_parameter nodes specifically
    const tree = parseKotlin('class Box<T>');
    const classDecl = tree.rootNode.children.find((c) => c.type === 'class_declaration');
    const typeParams = findChildByType(classDecl!, 'type_parameters');
    // Get the comma or bracket instead of a type_parameter
    const nonTypeParam = typeParams?.children.find((c) => c.type === '<');
    if (nonTypeParam) {
      const result = extractSingleTypeParameter(nonTypeParam);
      expect(result).toBeUndefined();
    }
  });
});
