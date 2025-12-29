/**
 * Tests for Java sealed class permits extraction.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractPermits } from './extract-permits.js';

/**
 * Helper to get the class_declaration node from parsed Java code.
 */
function getClassDeclaration(code: string) {
  const tree = parseJava(code);
  return findChildByType(tree.rootNode, 'class_declaration');
}

/**
 * Helper to get the interface_declaration node from parsed Java code.
 */
function getInterfaceDeclaration(code: string) {
  const tree = parseJava(code);
  return findChildByType(tree.rootNode, 'interface_declaration');
}

describe('extractPermits', () => {
  describe('sealed classes', () => {
    it('should extract single permitted subclass', () => {
      const node = getClassDeclaration('sealed class Shape permits Circle {}');
      const permits = extractPermits(node!);

      expect(permits).toEqual(['Circle']);
    });

    it('should extract multiple permitted subclasses', () => {
      const node = getClassDeclaration(
        'sealed class Shape permits Circle, Rectangle, Triangle {}'
      );
      const permits = extractPermits(node!);

      expect(permits).toEqual(['Circle', 'Rectangle', 'Triangle']);
    });

    it('should extract qualified type names', () => {
      const node = getClassDeclaration(
        'sealed class Shape permits com.shapes.Circle, com.shapes.Rectangle {}'
      );
      const permits = extractPermits(node!);

      expect(permits).toEqual(['com.shapes.Circle', 'com.shapes.Rectangle']);
    });
  });

  describe('sealed interfaces', () => {
    it('should extract permits from sealed interface', () => {
      const node = getInterfaceDeclaration(
        'sealed interface Vehicle permits Car, Truck {}'
      );
      const permits = extractPermits(node!);

      expect(permits).toEqual(['Car', 'Truck']);
    });
  });

  describe('non-sealed classes', () => {
    it('should return undefined for regular class', () => {
      const node = getClassDeclaration('class Foo {}');
      const permits = extractPermits(node!);

      expect(permits).toBeUndefined();
    });

    it('should return undefined for abstract class without permits', () => {
      const node = getClassDeclaration('abstract class Foo {}');
      const permits = extractPermits(node!);

      expect(permits).toBeUndefined();
    });
  });
});
