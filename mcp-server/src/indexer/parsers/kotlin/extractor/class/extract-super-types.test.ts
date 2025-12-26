import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSuperTypes } from './extract-super-types.js';

/**
 * Helper to find a class_declaration node.
 */
function findClassDeclaration(code: string): ReturnType<typeof findChildByType> {
  const tree = parseKotlin(code);
  return findChildByType(tree.rootNode, 'class_declaration');
}

describe('extractSuperTypes', () => {
  describe('no inheritance', () => {
    it('should return empty result for class without super types', () => {
      const code = 'class User';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual([]);
    });

    it('should return empty result for class with only body', () => {
      const code = `
        class User {
          val name = "test"
        }
      `;
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('superclass only', () => {
    it('should extract superclass with constructor call', () => {
      const code = 'class User : BaseEntity()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseEntity');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract superclass with constructor arguments', () => {
      const code = 'class Admin : User("admin")';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('User');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract generic superclass', () => {
      const code = 'class StringList : ArrayList<String>()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('ArrayList<String>');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract superclass with multiple generic parameters', () => {
      const code = 'class UserMap : HashMap<String, User>()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('HashMap<String, User>');
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('interfaces only', () => {
    it('should extract single interface', () => {
      const code = 'class User : Serializable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should extract multiple interfaces', () => {
      const code = 'class User : Serializable, Comparable<User>';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toContain('Serializable');
      expect(result.interfaces).toContain('Comparable<User>');
      expect(result.interfaces.length).toBe(2);
    });

    it('should extract generic interface', () => {
      const code = 'class UserRepository : Repository<User, Long>';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Repository<User, Long>']);
    });
  });

  describe('superclass and interfaces', () => {
    it('should extract superclass and single interface', () => {
      const code = 'class User : BaseEntity(), Serializable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseEntity');
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should extract superclass and multiple interfaces', () => {
      const code = 'class User : BaseEntity(), Serializable, Comparable<User>, Cloneable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseEntity');
      expect(result.interfaces).toContain('Serializable');
      expect(result.interfaces).toContain('Comparable<User>');
      expect(result.interfaces).toContain('Cloneable');
      expect(result.interfaces.length).toBe(3);
    });

    it('should handle superclass with arguments and interfaces', () => {
      const code = 'class Admin : User("admin", Role.ADMIN), Auditable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('User');
      expect(result.interfaces).toEqual(['Auditable']);
    });
  });

  describe('complex cases', () => {
    it('should handle data class with interfaces', () => {
      const code = 'data class User(val name: String) : Serializable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable']);
    });

    it('should handle sealed class with superclass', () => {
      const code = 'sealed class Result : BaseResult()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseResult');
      expect(result.interfaces).toEqual([]);
    });

    it('should handle abstract class with interfaces', () => {
      const code = 'abstract class Repository : CrudRepository<Entity, Long>, Searchable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toContain('CrudRepository<Entity, Long>');
      expect(result.interfaces).toContain('Searchable');
    });

    it('should handle nested generic types in superclass', () => {
      const code = 'class ComplexList : ArrayList<Map<String, List<Int>>>()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('ArrayList<Map<String, List<Int>>>');
      expect(result.interfaces).toEqual([]);
    });

    it('should handle qualified type names', () => {
      const code = 'class User : com.example.base.BaseEntity()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('com.example.base.BaseEntity');
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('interface declarations', () => {
    it('should extract super interfaces from interface declaration', () => {
      const code = 'interface Repository : CrudRepository, Searchable';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      // Interfaces don't have superclass (no constructor call)
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toContain('CrudRepository');
      expect(result.interfaces).toContain('Searchable');
    });

    it('should extract generic super interface', () => {
      const code = 'interface UserRepository : Repository<User, Long>';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Repository<User, Long>']);
    });
  });

  describe('edge cases', () => {
    it('should handle class with primary constructor and superclass', () => {
      const code = 'class User(val name: String) : BaseEntity()';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseEntity');
      expect(result.interfaces).toEqual([]);
    });

    it('should handle class with where clause', () => {
      const code = 'class Container<T> : BaseContainer<T>() where T : Comparable<T>';
      const node = findClassDeclaration(code);
      expect(node).not.toBeNull();
      const result = extractSuperTypes(node!);
      expect(result.superClass).toBe('BaseContainer<T>');
    });

    it('should handle inner class with superclass', () => {
      const code = `
        class Outer {
          inner class Inner : BaseInner()
        }
      `;
      // Find the inner class
      const tree = parseKotlin(code);
      let innerClass: ReturnType<typeof findChildByType> = null;
      let depth = 0;
      const traverse = (node: any): void => {
        if (node.type === 'class_declaration') {
          depth++;
          if (depth === 2) {
            innerClass = node;
            return;
          }
        }
        for (const child of node.children) {
          traverse(child);
        }
      };
      traverse(tree.rootNode);
      expect(innerClass).not.toBeNull();
      const result = extractSuperTypes(innerClass!);
      expect(result.superClass).toBe('BaseInner');
    });
  });
});
