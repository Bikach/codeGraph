import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractCompanionObject } from './extract-companion-object.js';
import type { ClassBodyExtractor } from './extract-companion-object.js';

/**
 * Find the first companion_object node in the source.
 */
function findCompanionObject(source: string) {
  const tree = parseKotlin(source);
  let companionObject: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'companion_object' && !companionObject) {
      companionObject = node;
    }
  });
  return companionObject;
}

/**
 * Mock extractClassBody that returns empty arrays.
 */
const mockExtractClassBody: ClassBodyExtractor = () => ({
  properties: [],
  functions: [],
  nestedClasses: [],
  companionObject: undefined,
  secondaryConstructors: [],
});

/**
 * Mock extractClassBody that simulates extracted members.
 */
const mockWithMembers: ClassBodyExtractor = () => ({
  properties: [
    {
      name: 'instance',
      type: 'MyClass',
      isVal: true,
      visibility: 'public',
      annotations: [],
      location: { filePath: 'test.kt', startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
    },
  ],
  functions: [
    {
      name: 'create',
      parameters: [],
      returnType: 'MyClass',
      visibility: 'public',
      isAbstract: false,
      isSuspend: false,
      isExtension: false,
      isInline: false,
      isOperator: false,
      isInfix: false,
      annotations: [],
      calls: [],
      location: { filePath: 'test.kt', startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
    },
  ],
  nestedClasses: [],
  companionObject: undefined,
  secondaryConstructors: [],
});

describe('extractCompanionObject', () => {
  describe('basic extraction', () => {
    it('should extract companion object with default name', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {
            val x = 1
          }
        }
      `);
      expect(node).toBeDefined();
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.name).toBe('Companion');
    });

    it('should extract companion object with custom name', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object Factory {
            fun create() = MyClass()
          }
        }
      `);
      expect(node).toBeDefined();
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.name).toBe('Factory');
    });

    it('should have kind "object"', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.kind).toBe('object');
    });
  });

  describe('modifiers', () => {
    it('should default to public visibility', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findCompanionObject(`
        class MyClass {
          private companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.visibility).toBe('private');
    });

    it('should always have isAbstract as false', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.isAbstract).toBe(false);
    });

    it('should always have isData as false', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.isData).toBe(false);
    });

    it('should always have isSealed as false', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.isSealed).toBe(false);
    });
  });

  describe('inheritance', () => {
    it('should have no superClass', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.superClass).toBeUndefined();
    });

    it('should have empty interfaces array', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.interfaces).toEqual([]);
    });
  });

  describe('class body delegation', () => {
    it('should call extractClassBody callback', () => {
      let callbackCalled = false;
      const trackingExtractor: ClassBodyExtractor = (classBody) => {
        callbackCalled = true;
        expect(classBody).toBeDefined();
        return {
          properties: [],
          functions: [],
          nestedClasses: [],
          companionObject: undefined,
          secondaryConstructors: [],
        };
      };

      const node = findCompanionObject(`
        class MyClass {
          companion object {
            val x = 1
          }
        }
      `);
      extractCompanionObject(node!, trackingExtractor);
      expect(callbackCalled).toBe(true);
    });

    it('should include extracted properties', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {
            val instance: MyClass = MyClass()
          }
        }
      `);
      const result = extractCompanionObject(node!, mockWithMembers);
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]?.name).toBe('instance');
    });

    it('should include extracted functions', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {
            fun create() = MyClass()
          }
        }
      `);
      const result = extractCompanionObject(node!, mockWithMembers);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]?.name).toBe('create');
    });

    it('should include extracted nested classes', () => {
      const mockWithNested: ClassBodyExtractor = () => ({
        properties: [],
        functions: [],
        nestedClasses: [
          {
            name: 'Builder',
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
          },
        ],
        companionObject: undefined,
        secondaryConstructors: [],
      });

      const node = findCompanionObject(`
        class MyClass {
          companion object {
            class Builder {}
          }
        }
      `);
      const result = extractCompanionObject(node!, mockWithNested);
      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]?.name).toBe('Builder');
    });
  });

  describe('annotations', () => {
    it('should extract annotations on companion object', () => {
      const node = findCompanionObject(`
        class MyClass {
          @JvmStatic
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      // Annotations might be on the companion object itself
      expect(result.annotations).toBeDefined();
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findCompanionObject(`
        class MyClass {
          companion object {}
        }
      `);
      const result = extractCompanionObject(node!, mockExtractClassBody);
      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThan(0);
    });
  });
});
