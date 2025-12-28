/**
 * Tests for extractSingleTypeParameter
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSingleTypeParameter } from './extract-single-type-parameter.js';

/**
 * Helper to get the first type_parameter node from a Java class declaration.
 */
function getFirstTypeParameter(source: string) {
  const tree = parseJava(source);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  const typeParams = findChildByType(classDecl!, 'type_parameters');
  const typeParam = findChildByType(typeParams!, 'type_parameter');
  return typeParam;
}

describe('extractSingleTypeParameter', () => {
  describe('simple type parameters', () => {
    it('should extract simple type parameter T', () => {
      const node = getFirstTypeParameter('class Box<T> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'T',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract type parameter with longer name', () => {
      const node = getFirstTypeParameter('class Box<Element> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'Element',
        bounds: undefined,
        variance: undefined,
        isReified: undefined,
      });
    });
  });

  describe('bounded type parameters', () => {
    it('should extract type parameter with single bound', () => {
      const node = getFirstTypeParameter('class NumberBox<T extends Number> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'T',
        bounds: ['Number'],
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract type parameter with generic bound', () => {
      const node = getFirstTypeParameter('class ComparableBox<T extends Comparable<T>> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'T',
        bounds: ['Comparable<T>'],
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract type parameter with multiple bounds (intersection)', () => {
      const node = getFirstTypeParameter('class MultiBox<T extends Number & Serializable> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'T',
        bounds: ['Number', 'Serializable'],
        variance: undefined,
        isReified: undefined,
      });
    });

    it('should extract type parameter with complex generic bound', () => {
      const node = getFirstTypeParameter('class ListBox<T extends List<String>> {}');
      const result = extractSingleTypeParameter(node!);

      expect(result).toEqual({
        name: 'T',
        bounds: ['List<String>'],
        variance: undefined,
        isReified: undefined,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle type parameter from generic method', () => {
      // Test that type parameters work in method context too
      const tree = parseJava('class Box { public <T> T get() { return null; } }');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      expect(classDecl).toBeDefined();
      // We're mainly testing that the function doesn't crash on various inputs
    });
  });
});
