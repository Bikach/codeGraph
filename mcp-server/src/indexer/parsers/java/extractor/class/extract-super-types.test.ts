/**
 * Tests for extractSuperTypes
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSuperTypes } from './extract-super-types.js';

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

/**
 * Helper to get an enum declaration node from Java source.
 */
function getEnumDeclaration(source: string) {
  const tree = parseJava(source);
  return findChildByType(tree.rootNode, 'enum_declaration');
}

describe('extractSuperTypes', () => {
  describe('classes without inheritance', () => {
    it('should return empty for class without extends or implements', () => {
      const node = getClassDeclaration('class Foo {}');
      const result = extractSuperTypes(node!);

      expect(result).toEqual({
        superClass: undefined,
        interfaces: [],
      });
    });
  });

  describe('class extends', () => {
    it('should extract simple superclass', () => {
      const node = getClassDeclaration('class Foo extends Bar {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract generic superclass', () => {
      const node = getClassDeclaration('class StringList extends ArrayList<String> {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('ArrayList<String>');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract fully qualified superclass', () => {
      const node = getClassDeclaration('class Foo extends java.util.ArrayList {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('java.util.ArrayList');
    });
  });

  describe('class implements', () => {
    it('should extract single interface', () => {
      const node = getClassDeclaration('class Foo implements Serializable {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should extract multiple interfaces', () => {
      const node = getClassDeclaration('class Foo implements Serializable, Cloneable {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable', 'Cloneable']);
    });

    it('should extract generic interface', () => {
      const node = getClassDeclaration('class Foo implements Comparable<Foo> {}');
      const result = extractSuperTypes(node!);

      expect(result.interfaces).toEqual(['Comparable<Foo>']);
    });

    it('should extract multiple generic interfaces', () => {
      const node = getClassDeclaration('class Foo implements List<String>, Comparable<Foo> {}');
      const result = extractSuperTypes(node!);

      expect(result.interfaces).toHaveLength(2);
      expect(result.interfaces).toContain('List<String>');
      expect(result.interfaces).toContain('Comparable<Foo>');
    });
  });

  describe('class extends and implements', () => {
    it('should extract both superclass and interfaces', () => {
      const node = getClassDeclaration('class Foo extends Bar implements Serializable {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should extract superclass and multiple interfaces', () => {
      const node = getClassDeclaration('class Foo extends Bar implements Serializable, Cloneable {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual(['Serializable', 'Cloneable']);
    });

    it('should handle complex generic hierarchy', () => {
      const node = getClassDeclaration(
        'class MyMap<K, V> extends HashMap<K, V> implements Serializable, Cloneable {}'
      );
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBe('HashMap<K, V>');
      expect(result.interfaces).toContain('Serializable');
      expect(result.interfaces).toContain('Cloneable');
    });
  });

  describe('interface extends', () => {
    it('should extract single super interface', () => {
      const node = getInterfaceDeclaration('interface Foo extends Bar {}');
      const result = extractSuperTypes(node!);

      // For interfaces, extends goes into interfaces array
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Bar']);
    });

    it('should extract multiple super interfaces', () => {
      const node = getInterfaceDeclaration('interface Foo extends Bar, Baz {}');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Bar', 'Baz']);
    });

    it('should extract generic super interface', () => {
      const node = getInterfaceDeclaration('interface MyComparable<T> extends Comparable<T> {}');
      const result = extractSuperTypes(node!);

      expect(result.interfaces).toEqual(['Comparable<T>']);
    });
  });

  describe('enum implements', () => {
    it('should extract interface from enum', () => {
      const node = getEnumDeclaration('enum Status implements Serializable { ACTIVE }');
      const result = extractSuperTypes(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should extract multiple interfaces from enum', () => {
      const node = getEnumDeclaration('enum Status implements Serializable, Comparable<Status> { ACTIVE }');
      const result = extractSuperTypes(node!);

      expect(result.interfaces).toHaveLength(2);
    });
  });
});
