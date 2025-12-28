/**
 * Tests for mapClassKind and isRecordDeclaration
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { mapClassKind, isRecordDeclaration } from './map-class-kind.js';

/**
 * Helper to get the first type declaration from Java source.
 */
function getTypeDeclaration(source: string) {
  const tree = parseJava(source);
  // Try each type of declaration
  return (
    findChildByType(tree.rootNode, 'class_declaration') ??
    findChildByType(tree.rootNode, 'interface_declaration') ??
    findChildByType(tree.rootNode, 'enum_declaration') ??
    findChildByType(tree.rootNode, 'annotation_type_declaration') ??
    findChildByType(tree.rootNode, 'record_declaration')
  );
}

describe('mapClassKind', () => {
  describe('class declarations', () => {
    it('should map class_declaration to class', () => {
      const node = getTypeDeclaration('class Foo {}');
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should map public class to class', () => {
      const node = getTypeDeclaration('public class Foo {}');
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should map abstract class to class', () => {
      const node = getTypeDeclaration('abstract class Foo {}');
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should map final class to class', () => {
      const node = getTypeDeclaration('final class Foo {}');
      expect(mapClassKind(node!)).toBe('class');
    });
  });

  describe('interface declarations', () => {
    it('should map interface_declaration to interface', () => {
      const node = getTypeDeclaration('interface Foo {}');
      expect(mapClassKind(node!)).toBe('interface');
    });

    it('should map public interface to interface', () => {
      const node = getTypeDeclaration('public interface Foo {}');
      expect(mapClassKind(node!)).toBe('interface');
    });
  });

  describe('enum declarations', () => {
    it('should map enum_declaration to enum', () => {
      const node = getTypeDeclaration('enum Status { ACTIVE, INACTIVE }');
      expect(mapClassKind(node!)).toBe('enum');
    });

    it('should map public enum to enum', () => {
      const node = getTypeDeclaration('public enum Status { ACTIVE }');
      expect(mapClassKind(node!)).toBe('enum');
    });
  });

  describe('annotation declarations', () => {
    it('should map annotation_type_declaration to annotation', () => {
      const node = getTypeDeclaration('@interface MyAnnotation {}');
      expect(mapClassKind(node!)).toBe('annotation');
    });

    it('should map public annotation to annotation', () => {
      const node = getTypeDeclaration('public @interface MyAnnotation {}');
      expect(mapClassKind(node!)).toBe('annotation');
    });
  });

  describe('record declarations (Java 16+)', () => {
    it('should map record_declaration to class', () => {
      const node = getTypeDeclaration('record Point(int x, int y) {}');
      // Records might not be supported by all tree-sitter-java versions
      if (node && node.type === 'record_declaration') {
        expect(mapClassKind(node)).toBe('class');
      }
    });
  });
});

describe('isRecordDeclaration', () => {
  it('should return false for class declaration', () => {
    const node = getTypeDeclaration('class Foo {}');
    expect(isRecordDeclaration(node!)).toBe(false);
  });

  it('should return false for interface declaration', () => {
    const node = getTypeDeclaration('interface Foo {}');
    expect(isRecordDeclaration(node!)).toBe(false);
  });

  it('should return false for enum declaration', () => {
    const node = getTypeDeclaration('enum Status { ACTIVE }');
    expect(isRecordDeclaration(node!)).toBe(false);
  });

  it('should return true for record declaration if supported', () => {
    const node = getTypeDeclaration('record Point(int x, int y) {}');
    if (node && node.type === 'record_declaration') {
      expect(isRecordDeclaration(node)).toBe(true);
    }
  });
});
