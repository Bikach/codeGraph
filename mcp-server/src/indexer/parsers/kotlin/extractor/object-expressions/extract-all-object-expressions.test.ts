import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractAllObjectExpressions } from './extract-all-object-expressions.js';
import type { ClassBodyExtractor } from './types.js';

/**
 * Mock extractClassBody that returns empty arrays.
 */
const mockExtractClassBody: ClassBodyExtractor = () => ({
  properties: [],
  functions: [],
});

describe('extractAllObjectExpressions', () => {
  describe('basic extraction', () => {
    it('should return empty array when no object expressions', () => {
      const tree = parseKotlin(`
        class Simple {
          fun test() {}
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(0);
    });

    it('should extract single object expression', () => {
      const tree = parseKotlin(`
        val listener = object : OnClickListener {
          override fun onClick() {}
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });

    it('should extract multiple object expressions', () => {
      const tree = parseKotlin(`
        val listener1 = object : Listener1 {}
        val listener2 = object : Listener2 {}
        val listener3 = object {}
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(3);
    });
  });

  describe('nested object expressions', () => {
    it('should extract object expression inside function', () => {
      const tree = parseKotlin(`
        fun createListener(): Listener {
          return object : Listener {
            override fun onEvent() {}
          }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });

    it('should extract object expression inside class method', () => {
      const tree = parseKotlin(`
        class Handler {
          fun setup() {
            val callback = object : Callback {
              override fun invoke() {}
            }
          }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });

    it('should extract multiple nested object expressions', () => {
      const tree = parseKotlin(`
        class Manager {
          fun setup() {
            val first = object : First {}
            val second = object : Second {}
          }

          fun cleanup() {
            val third = object : Third {}
          }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(3);
    });

    it('should extract deeply nested object expression', () => {
      const tree = parseKotlin(`
        class Outer {
          class Inner {
            fun create() {
              val obj = object : Interface {
                override fun method() {}
              }
            }
          }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });
  });

  describe('object expressions in various contexts', () => {
    it('should extract object expression in lambda', () => {
      const tree = parseKotlin(`
        val factory = {
          object : Runnable {
            override fun run() {}
          }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });

    it('should extract object expression passed as argument', () => {
      const tree = parseKotlin(`
        fun test() {
          runOnUiThread(object : Runnable {
            override fun run() {}
          })
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
    });

    it('should extract object expression in when branch', () => {
      const tree = parseKotlin(`
        fun getListener(type: Int): Listener = when(type) {
          1 -> object : Listener { override fun onEvent() {} }
          else -> object : Listener { override fun onEvent() {} }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract object expression in if expression', () => {
      const tree = parseKotlin(`
        val listener = if (condition) {
          object : Listener { override fun onEvent() {} }
        } else {
          object : Listener { override fun onEvent() {} }
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('supertype extraction', () => {
    it('should preserve supertypes in extracted expressions', () => {
      const tree = parseKotlin(`
        val listener = object : OnClickListener {
          override fun onClick() {}
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions[0]?.superTypes).toContain('OnClickListener');
    });

    it('should extract object with no supertypes', () => {
      const tree = parseKotlin(`
        val obj = object {
          val x = 1
        }
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions).toHaveLength(1);
      expect(expressions[0]?.superTypes).toHaveLength(0);
    });
  });

  describe('callback invocation', () => {
    it('should call extractClassBody for each object expression', () => {
      let callCount = 0;
      const countingExtractor: ClassBodyExtractor = () => {
        callCount++;
        return { properties: [], functions: [] };
      };

      const tree = parseKotlin(`
        val obj1 = object {}
        val obj2 = object {}
      `);
      extractAllObjectExpressions(tree.rootNode, countingExtractor);
      expect(callCount).toBe(2);
    });
  });

  describe('location information', () => {
    it('should include location for each extracted expression', () => {
      const tree = parseKotlin(`
        val obj = object : Interface {}
      `);
      const expressions = extractAllObjectExpressions(tree.rootNode, mockExtractClassBody);
      expect(expressions[0]?.location).toBeDefined();
      expect(expressions[0]?.location.startLine).toBeGreaterThan(0);
    });
  });
});
