import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType, traverseNode } from '../ast-utils/index.js';
import { mapClassKind } from './map-class-kind.js';

/**
 * Helper to find a class-like declaration node (class, interface, object, enum).
 */
function findClassLikeDeclaration(
  code: string,
  types: string[] = ['class_declaration', 'object_declaration']
): ReturnType<typeof findChildByType> {
  const tree = parseKotlin(code);
  let found: ReturnType<typeof findChildByType> = null;
  traverseNode(tree.rootNode, (node) => {
    if (types.includes(node.type)) {
      found = node;
      return false; // stop traversal
    }
    return true;
  });
  return found;
}

describe('mapClassKind', () => {
  describe('class', () => {
    it('should return "class" for a regular class', () => {
      const code = 'class User';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should return "class" for an abstract class', () => {
      const code = 'abstract class Base';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should return "class" for a data class', () => {
      const code = 'data class User(val name: String)';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should return "class" for a sealed class', () => {
      const code = 'sealed class Result';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should return "class" for an open class', () => {
      const code = 'open class Extensible';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should return "class" for an inner class', () => {
      const code = `
        class Outer {
          inner class Inner
        }
      `;
      const tree = parseKotlin(code);
      let innerClass: ReturnType<typeof findChildByType> = null;
      let depth = 0;
      traverseNode(tree.rootNode, (node) => {
        if (node.type === 'class_declaration') {
          depth++;
          if (depth === 2) {
            innerClass = node;
            return false;
          }
        }
        return true;
      });
      expect(innerClass).not.toBeNull();
      expect(mapClassKind(innerClass!)).toBe('class');
    });
  });

  describe('interface', () => {
    it('should return "interface" for an interface', () => {
      const code = 'interface Repository';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('interface');
    });

    it('should return "interface" for an interface with methods', () => {
      const code = `
        interface Repository {
          fun findById(id: Long): Entity?
          fun save(entity: Entity)
        }
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('interface');
    });

    it('should return "interface" for a sealed interface', () => {
      const code = 'sealed interface Event';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('interface');
    });

    // Note: 'fun interface' (SAM) syntax is not supported by tree-sitter-kotlin
    // It produces an ERROR node instead of class_declaration
    it.skip('should return "interface" for a fun interface (SAM) - not supported by tree-sitter', () => {
      const code = 'fun interface Callback { fun invoke() }';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('interface');
    });
  });

  describe('object', () => {
    it('should return "object" for an object declaration', () => {
      const code = 'object Singleton';
      const node = findClassLikeDeclaration(code, ['object_declaration']);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('object');
    });

    it('should return "object" for an object with body', () => {
      const code = `
        object Database {
          val connection = "conn"
          fun query() {}
        }
      `;
      const node = findClassLikeDeclaration(code, ['object_declaration']);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('object');
    });

    it('should return "object" for an object implementing interface', () => {
      const code = 'object Logger : LoggingStrategy';
      const node = findClassLikeDeclaration(code, ['object_declaration']);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('object');
    });
  });

  describe('enum', () => {
    it('should return "enum" for an enum class', () => {
      const code = 'enum class Status { ACTIVE, INACTIVE }';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('enum');
    });

    it('should return "enum" for an enum with constructor', () => {
      const code = `
        enum class Color(val hex: String) {
          RED("#FF0000"),
          GREEN("#00FF00"),
          BLUE("#0000FF")
        }
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('enum');
    });

    it('should return "enum" for an enum with methods', () => {
      const code = `
        enum class Direction {
          NORTH, SOUTH, EAST, WEST;

          fun opposite(): Direction = when (this) {
            NORTH -> SOUTH
            SOUTH -> NORTH
            EAST -> WEST
            WEST -> EAST
          }
        }
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('enum');
    });
  });

  describe('annotation', () => {
    it('should return "annotation" for an annotation class', () => {
      const code = 'annotation class MyAnnotation';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('annotation');
    });

    it('should return "annotation" for an annotation with parameters', () => {
      const code = `
        annotation class Route(
          val path: String,
          val method: String = "GET"
        )
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('annotation');
    });

    it('should return "annotation" for an annotation with target', () => {
      const code = `
        @Target(AnnotationTarget.FIELD)
        annotation class Inject
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('annotation');
    });

    it('should return "annotation" for an annotation with retention', () => {
      const code = `
        @Retention(AnnotationRetention.RUNTIME)
        annotation class Api
      `;
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('annotation');
    });
  });

  describe('edge cases', () => {
    it('should handle private class', () => {
      const code = 'private class Internal';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should handle class with generics', () => {
      const code = 'class Container<T>';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('class');
    });

    it('should handle interface with generics', () => {
      const code = 'interface Repository<T, ID>';
      const node = findClassLikeDeclaration(code);
      expect(node).not.toBeNull();
      expect(mapClassKind(node!)).toBe('interface');
    });
  });
});
