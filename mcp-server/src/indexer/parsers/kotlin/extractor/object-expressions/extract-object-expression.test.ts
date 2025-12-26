import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractObjectExpression } from './extract-object-expression.js';
import type { ClassBodyExtractor } from './types.js';

/**
 * Find the first object_literal node in the source.
 */
function findObjectLiteral(source: string) {
  const tree = parseKotlin(source);
  let objectLiteral: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'object_literal' && !objectLiteral) {
      objectLiteral = node;
    }
  });
  return objectLiteral;
}

/**
 * Mock extractClassBody that returns empty arrays.
 * This isolates the test from the actual class body extraction.
 */
const mockExtractClassBody: ClassBodyExtractor = () => ({
  properties: [],
  functions: [],
});

/**
 * Mock extractClassBody that simulates extracted members.
 */
const mockWithMembers: ClassBodyExtractor = () => ({
  properties: [
    {
      name: 'mockProperty',
      type: 'String',
      isVal: true,
      visibility: 'public',
      annotations: [],
      location: { filePath: 'test.kt', startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
    },
  ],
  functions: [
    {
      name: 'mockFunction',
      parameters: [],
      returnType: 'Unit',
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
});

describe('extractObjectExpression', () => {
  describe('basic extraction', () => {
    it('should extract object expression with no supertypes', () => {
      const node = findObjectLiteral(`
        val obj = object {
          fun doSomething() {}
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr).toBeDefined();
      expect(expr!.superTypes).toHaveLength(0);
    });

    it('should return ParsedObjectExpression structure', () => {
      const node = findObjectLiteral(`
        val obj = object {}
      `);
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr).toHaveProperty('superTypes');
      expect(expr).toHaveProperty('properties');
      expect(expr).toHaveProperty('functions');
      expect(expr).toHaveProperty('location');
    });
  });

  describe('supertype extraction', () => {
    it('should extract single interface implementation', () => {
      const node = findObjectLiteral(`
        val listener = object : OnClickListener {
          override fun onClick() {}
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.superTypes).toContain('OnClickListener');
    });

    it('should extract class extension with constructor call', () => {
      const node = findObjectLiteral(`
        val handler = object : Handler() {
          override fun handleMessage() {}
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.superTypes).toContain('Handler');
    });

    it('should extract multiple supertypes', () => {
      const node = findObjectLiteral(`
        val obj = object : Runnable, Comparable<Int> {
          override fun run() {}
          override fun compareTo(other: Int) = 0
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.superTypes.length).toBeGreaterThanOrEqual(1);
      expect(expr!.superTypes).toContain('Runnable');
    });

    it('should extract generic supertype', () => {
      const node = findObjectLiteral(`
        val comparator = object : Comparator<String> {
          override fun compare(a: String, b: String) = 0
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.superTypes.some((t) => t.includes('Comparator'))).toBe(true);
    });
  });

  describe('class body delegation', () => {
    it('should pass class body to extractClassBody callback', () => {
      let classBodyWasCalled = false;
      const trackingExtractor: ClassBodyExtractor = (classBody) => {
        classBodyWasCalled = true;
        expect(classBody).toBeDefined();
        return { properties: [], functions: [] };
      };

      const node = findObjectLiteral(`
        val obj = object {
          val x = 1
          fun test() {}
        }
      `);
      extractObjectExpression(node!, trackingExtractor);
      expect(classBodyWasCalled).toBe(true);
    });

    it('should include extracted properties from callback', () => {
      const node = findObjectLiteral(`val obj = object { val x = 1 }`);
      const expr = extractObjectExpression(node!, mockWithMembers);
      expect(expr!.properties).toHaveLength(1);
      expect(expr!.properties[0]?.name).toBe('mockProperty');
    });

    it('should include extracted functions from callback', () => {
      const node = findObjectLiteral(`val obj = object { fun test() {} }`);
      const expr = extractObjectExpression(node!, mockWithMembers);
      expect(expr!.functions).toHaveLength(1);
      expect(expr!.functions[0]?.name).toBe('mockFunction');
    });
  });

  describe('location information', () => {
    it('should include location with start line', () => {
      const node = findObjectLiteral(`val obj = object {}`);
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.location).toBeDefined();
      expect(expr!.location.startLine).toBeGreaterThan(0);
    });

    it('should include location with columns', () => {
      const node = findObjectLiteral(`val obj = object {}`);
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.location.startColumn).toBeGreaterThan(0);
      expect(expr!.location.endColumn).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object body', () => {
      const node = findObjectLiteral(`val obj = object {}`);
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr).toBeDefined();
      expect(expr!.superTypes).toHaveLength(0);
    });

    it('should handle object in function return', () => {
      const node = findObjectLiteral(`
        fun createListener() = object : Listener {
          override fun onEvent() {}
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr!.superTypes).toContain('Listener');
    });

    it('should handle object in lambda', () => {
      const node = findObjectLiteral(`
        val factory = {
          object : Factory {
            override fun create() = Unit
          }
        }
      `);
      expect(node).toBeDefined();
      const expr = extractObjectExpression(node!, mockExtractClassBody);
      expect(expr).toBeDefined();
    });
  });
});
