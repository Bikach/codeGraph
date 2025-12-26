import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractClassBody } from './extract-class-body.js';
import type { ClassExtractor, CompanionObjectExtractor } from './extract-class-body.js';
import type { ParsedClass } from '../../../../types.js';

/**
 * Find the first class_body node in the source.
 */
function findClassBody(source: string) {
  const tree = parseKotlin(source);
  let classBody: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'class_body' && !classBody) {
      classBody = node;
    }
  });
  return classBody;
}

/**
 * Mock class for nested class extraction.
 */
function createMockClass(name: string): ParsedClass {
  return {
    name,
    kind: 'class',
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
  };
}

/**
 * Find the name of a class-like node.
 */
function findClassName(node: import('tree-sitter').SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text;

  // For some node types, try type_identifier
  for (const child of node.children) {
    if (child.type === 'type_identifier' || child.type === 'simple_identifier') {
      return child.text;
    }
  }
  return 'MockClass';
}

/**
 * Mock extractClass that returns a simple ParsedClass with the actual name.
 */
const mockExtractClass: ClassExtractor = (node) => {
  return createMockClass(findClassName(node));
};

/**
 * Mock extractCompanionObject that returns a companion object.
 */
const mockExtractCompanionObject: CompanionObjectExtractor = () => ({
  ...createMockClass('Companion'),
  kind: 'object',
});

describe('extractClassBody', () => {
  describe('empty or undefined body', () => {
    it('should return empty arrays for undefined classBody', () => {
      const result = extractClassBody(undefined, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.nestedClasses).toEqual([]);
      expect(result.secondaryConstructors).toEqual([]);
      expect(result.companionObject).toBeUndefined();
    });

    it('should return empty arrays for empty class body', () => {
      const classBody = findClassBody('class Empty {}');
      expect(classBody).toBeDefined();
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
    });
  });

  describe('property extraction', () => {
    it('should extract val properties', () => {
      const classBody = findClassBody(`
        class MyClass {
          val name: String = ""
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]?.name).toBe('name');
      expect(result.properties[0]?.isVal).toBe(true);
    });

    it('should extract var properties', () => {
      const classBody = findClassBody(`
        class MyClass {
          var count: Int = 0
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]?.isVal).toBe(false);
    });

    it('should extract multiple properties', () => {
      const classBody = findClassBody(`
        class MyClass {
          val a: Int = 1
          var b: String = ""
          val c: Boolean = true
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties).toHaveLength(3);
    });
  });

  describe('function extraction', () => {
    it('should extract functions', () => {
      const classBody = findClassBody(`
        class MyClass {
          fun doSomething() {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]?.name).toBe('doSomething');
    });

    it('should extract multiple functions', () => {
      const classBody = findClassBody(`
        class MyClass {
          fun first() {}
          fun second() {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.functions).toHaveLength(2);
    });
  });

  describe('nested class extraction', () => {
    it('should extract nested class', () => {
      const classBody = findClassBody(`
        class Outer {
          class Inner {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]?.name).toBe('Inner');
    });

    it('should extract nested interface', () => {
      const classBody = findClassBody(`
        class Outer {
          interface Callback {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]?.name).toBe('Callback');
    });

    it('should extract nested enum', () => {
      const classBody = findClassBody(`
        class Outer {
          enum class Status { ACTIVE, INACTIVE }
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]?.name).toBe('Status');
    });

    it('should extract nested object (non-companion)', () => {
      const classBody = findClassBody(`
        class Outer {
          object Singleton {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]?.name).toBe('Singleton');
    });
  });

  describe('companion object extraction', () => {
    it('should extract companion object', () => {
      const classBody = findClassBody(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.companionObject).toBeDefined();
      expect(result.companionObject?.kind).toBe('object');
    });

    it('should not include companion object in nestedClasses', () => {
      const classBody = findClassBody(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.nestedClasses).toHaveLength(0);
    });
  });

  describe('secondary constructor extraction', () => {
    it('should extract secondary constructor', () => {
      const classBody = findClassBody(`
        class MyClass(val name: String) {
          constructor() : this("")
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.secondaryConstructors).toHaveLength(1);
    });

    it('should extract multiple secondary constructors', () => {
      const classBody = findClassBody(`
        class MyClass(val name: String) {
          constructor() : this("")
          constructor(id: Int) : this(id.toString())
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.secondaryConstructors).toHaveLength(2);
    });
  });

  describe('mixed content', () => {
    it('should extract all types of members', () => {
      const classBody = findClassBody(`
        class MyClass {
          val property: String = ""
          fun method() {}
          class Nested {}
          companion object {}
          constructor() : this("")
        }
      `);
      // Note: constructor() without primary constructor might not parse correctly
      // but we test the structure
      const result = extractClassBody(classBody!, mockExtractClass, mockExtractCompanionObject);
      expect(result.properties.length).toBeGreaterThanOrEqual(1);
      expect(result.functions.length).toBeGreaterThanOrEqual(1);
      expect(result.nestedClasses.length).toBeGreaterThanOrEqual(1);
      expect(result.companionObject).toBeDefined();
    });
  });

  describe('callback invocation', () => {
    it('should call extractClass for nested classes', () => {
      let extractClassCalled = false;
      const trackingExtractClass: ClassExtractor = () => {
        extractClassCalled = true;
        return createMockClass('Tracked');
      };

      const classBody = findClassBody(`
        class Outer {
          class Inner {}
        }
      `);
      extractClassBody(classBody!, trackingExtractClass, mockExtractCompanionObject);
      expect(extractClassCalled).toBe(true);
    });

    it('should call extractCompanionObject for companion objects', () => {
      let companionExtractorCalled = false;
      const trackingCompanionExtractor: CompanionObjectExtractor = () => {
        companionExtractorCalled = true;
        return { ...createMockClass('Companion'), kind: 'object' };
      };

      const classBody = findClassBody(`
        class MyClass {
          companion object {}
        }
      `);
      extractClassBody(classBody!, mockExtractClass, trackingCompanionExtractor);
      expect(companionExtractorCalled).toBe(true);
    });
  });
});
