import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractClass } from './extract-class.js';
import type { CompanionObjectExtractor } from './extract-class-body.js';

/**
 * Class-like declaration node types in tree-sitter-kotlin.
 */
const CLASS_LIKE_TYPES = [
  'class_declaration',
  'object_declaration',
  'interface_declaration',
  'enum_class_declaration',
  'annotation_declaration',
];

/**
 * Find the first class-like declaration node in the source.
 */
function findClassDeclaration(source: string) {
  const tree = parseKotlin(source);
  let classNode: import('tree-sitter').SyntaxNode | undefined;

  // For top-level declarations, they are direct children of the root
  for (const child of tree.rootNode.children) {
    if (CLASS_LIKE_TYPES.includes(child.type)) {
      classNode = child;
      break;
    }
  }

  // If not found at top level, search deeper
  if (!classNode) {
    traverseNode(tree.rootNode, (node) => {
      if (CLASS_LIKE_TYPES.includes(node.type) && !classNode) {
        classNode = node;
      }
    });
  }

  return classNode;
}

/**
 * Mock extractCompanionObject that returns a simple companion object.
 */
const mockExtractCompanionObject: CompanionObjectExtractor = () => ({
  name: 'Companion',
  kind: 'object',
  visibility: 'public',
  isAbstract: false,
  isData: false,
  isSealed: false,
  interfaces: [],
  annotations: [],
  properties: [],
  functions: [],
  nestedClasses: [],
  location: { filePath: 'test.kt', startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
});

describe('extractClass', () => {
  describe('basic class extraction', () => {
    it('should extract class name', () => {
      const node = findClassDeclaration('class MyClass {}');
      expect(node).toBeDefined();
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.name).toBe('MyClass');
    });

    it('should extract class kind as "class"', () => {
      const node = findClassDeclaration('class MyClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.kind).toBe('class');
    });

    it('should default to public visibility', () => {
      const node = findClassDeclaration('class MyClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.visibility).toBe('public');
    });
  });

  describe('interface extraction', () => {
    it('should extract interface', () => {
      // In tree-sitter-kotlin, interfaces are also class_declaration nodes
      const node = findClassDeclaration('interface MyInterface {}');
      expect(node).toBeDefined();
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.name).toBe('MyInterface');
      expect(result.kind).toBe('interface');
    });
  });

  describe('object extraction', () => {
    it('should extract object declaration', () => {
      // In tree-sitter-kotlin, object declarations may have different node types
      const node = findClassDeclaration('object MySingleton {}');
      expect(node).toBeDefined();
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.name).toBe('MySingleton');
      expect(result.kind).toBe('object');
    });
  });

  describe('enum extraction', () => {
    it('should extract enum class', () => {
      // In tree-sitter-kotlin, enum classes are class_declaration nodes
      const node = findClassDeclaration('enum class Status { ACTIVE, INACTIVE }');
      expect(node).toBeDefined();
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.name).toBe('Status');
      expect(result.kind).toBe('enum');
    });
  });

  describe('modifiers', () => {
    it('should extract private visibility', () => {
      const node = findClassDeclaration('private class PrivateClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.visibility).toBe('private');
    });

    it('should extract internal visibility', () => {
      const node = findClassDeclaration('internal class InternalClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.visibility).toBe('internal');
    });

    it('should extract protected visibility', () => {
      const node = findClassDeclaration('protected class ProtectedClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.visibility).toBe('protected');
    });

    it('should extract abstract modifier', () => {
      const node = findClassDeclaration('abstract class AbstractClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.isAbstract).toBe(true);
    });

    it('should extract data modifier', () => {
      const node = findClassDeclaration('data class DataClass(val id: Int)');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.isData).toBe(true);
    });

    it('should extract sealed modifier', () => {
      const node = findClassDeclaration('sealed class SealedClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.isSealed).toBe(true);
    });
  });

  describe('inheritance', () => {
    it('should extract superclass', () => {
      const node = findClassDeclaration('class Child : Parent() {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.superClass).toBe('Parent');
    });

    it('should extract implemented interface', () => {
      const node = findClassDeclaration('class MyClass : Runnable {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.interfaces).toContain('Runnable');
    });

    it('should extract multiple interfaces', () => {
      const node = findClassDeclaration('class MyClass : Runnable, Comparable<MyClass> {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.interfaces.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generics', () => {
    it('should extract type parameters', () => {
      const node = findClassDeclaration('class Container<T> {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.typeParameters).toBeDefined();
      expect(result.typeParameters).toHaveLength(1);
      expect(result.typeParameters![0]?.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = findClassDeclaration('class Map<K, V> {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.typeParameters).toHaveLength(2);
    });

    it('should have undefined typeParameters when none present', () => {
      const node = findClassDeclaration('class Simple {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.typeParameters).toBeUndefined();
    });
  });

  describe('primary constructor properties', () => {
    it('should extract val properties from primary constructor', () => {
      const node = findClassDeclaration('class Person(val name: String) {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.properties.some((p) => p.name === 'name')).toBe(true);
    });

    it('should extract var properties from primary constructor', () => {
      const node = findClassDeclaration('class Counter(var count: Int) {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      const countProp = result.properties.find((p) => p.name === 'count');
      expect(countProp).toBeDefined();
      expect(countProp?.isVal).toBe(false);
    });
  });

  describe('body members', () => {
    it('should extract body properties', () => {
      const node = findClassDeclaration(`
        class MyClass {
          val bodyProp: String = ""
        }
      `);
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.properties.some((p) => p.name === 'bodyProp')).toBe(true);
    });

    it('should extract body functions', () => {
      const node = findClassDeclaration(`
        class MyClass {
          fun myMethod() {}
        }
      `);
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.functions.some((f) => f.name === 'myMethod')).toBe(true);
    });

    it('should extract nested classes', () => {
      const node = findClassDeclaration(`
        class Outer {
          class Inner {}
        }
      `);
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.nestedClasses.some((c) => c.name === 'Inner')).toBe(true);
    });
  });

  describe('secondary constructors', () => {
    it('should extract secondary constructors', () => {
      const node = findClassDeclaration(`
        class MyClass(val name: String) {
          constructor() : this("")
        }
      `);
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.secondaryConstructors).toBeDefined();
      expect(result.secondaryConstructors).toHaveLength(1);
    });

    it('should have undefined secondaryConstructors when none present', () => {
      const node = findClassDeclaration('class Simple {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.secondaryConstructors).toBeUndefined();
    });
  });

  describe('annotations', () => {
    it('should extract class annotations', () => {
      const node = findClassDeclaration('@Deprecated class OldClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.annotations.some((a) => a.name === 'Deprecated')).toBe(true);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findClassDeclaration('class MyClass {}');
      const result = extractClass(node!, mockExtractCompanionObject);
      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThan(0);
    });
  });
});
