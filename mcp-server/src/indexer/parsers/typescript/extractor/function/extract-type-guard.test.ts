import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractTypeGuard } from './extract-type-guard.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract type guard from a function.
 */
function parseTypeGuard(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const funcNode = findChildByType(tree.rootNode, 'function_declaration');
  if (!funcNode) throw new Error('No function found');
  return extractTypeGuard(funcNode);
}

/**
 * Helper to parse and extract type guard from a method.
 */
function parseMethodTypeGuard(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  const classBody = findChildByType(classNode, 'class_body');
  if (!classBody) throw new Error('No class body found');
  const methodNode = findChildByType(classBody, 'method_definition');
  if (!methodNode) throw new Error('No method found');
  return extractTypeGuard(methodNode);
}

describe('extractTypeGuard', () => {
  describe('type predicate (is keyword)', () => {
    it('should extract simple type predicate', () => {
      const typeGuard = parseTypeGuard(`
        function isString(value: unknown): value is string {
          return typeof value === 'string';
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'string',
        isAssertion: false,
      });
    });

    it('should extract type predicate with custom type', () => {
      const typeGuard = parseTypeGuard(`
        function isUser(obj: unknown): obj is User {
          return typeof obj === 'object' && obj !== null;
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'obj',
        narrowedType: 'User',
        isAssertion: false,
      });
    });

    it('should extract type predicate with generic type', () => {
      const typeGuard = parseTypeGuard(`
        function isArray(value: unknown): value is Array<number> {
          return Array.isArray(value);
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'Array<number>',
        isAssertion: false,
      });
    });

    it('should extract type predicate with union type', () => {
      const typeGuard = parseTypeGuard(`
        function isStringOrNumber(x: unknown): x is string | number {
          return typeof x === 'string' || typeof x === 'number';
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'x',
        narrowedType: 'string | number',
        isAssertion: false,
      });
    });
  });

  describe('this type guard', () => {
    it('should extract this type guard', () => {
      const typeGuard = parseMethodTypeGuard(`
        class Animal {
          isCat(): this is Cat {
            return this instanceof Cat;
          }
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'this',
        narrowedType: 'Cat',
        isAssertion: false,
      });
    });

    it('should extract this type guard with generic type', () => {
      const typeGuard = parseMethodTypeGuard(`
        class Container<T> {
          hasValue(): this is Container<NonNullable<T>> {
            return this.value !== null && this.value !== undefined;
          }
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'this',
        narrowedType: 'Container<NonNullable<T>>',
        isAssertion: false,
      });
    });
  });

  describe('assertion function (asserts keyword)', () => {
    it('should extract simple assertion', () => {
      const typeGuard = parseTypeGuard(`
        function assertDefined<T>(value: T): asserts value is NonNullable<T> {
          if (value === null || value === undefined) throw new Error();
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'NonNullable<T>',
        isAssertion: true,
      });
    });

    it('should extract assertion with simple type', () => {
      const typeGuard = parseTypeGuard(`
        function assertString(value: unknown): asserts value is string {
          if (typeof value !== 'string') throw new TypeError();
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'string',
        isAssertion: true,
      });
    });

    it('should extract assertion with complex type', () => {
      const typeGuard = parseTypeGuard(`
        function assertUser(obj: unknown): asserts obj is { name: string; age: number } {
          if (!obj || typeof obj !== 'object') throw new Error();
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'obj',
        narrowedType: '{ name: string; age: number }',
        isAssertion: true,
      });
    });
  });

  describe('generic type guards', () => {
    it('should extract type guard with generic function', () => {
      const typeGuard = parseTypeGuard(`
        function isInstanceOf<T>(value: unknown, constructor: new (...args: any[]) => T): value is T {
          return value instanceof constructor;
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'T',
        isAssertion: false,
      });
    });

    it('should extract assertion with generic constraint', () => {
      const typeGuard = parseTypeGuard(`
        function assertHasLength<T extends { length: number }>(value: T): asserts value is T & { length: number } {
          if (typeof value.length !== 'number') throw new Error();
        }
      `);
      expect(typeGuard).toEqual({
        parameter: 'value',
        narrowedType: 'T & { length: number }',
        isAssertion: true,
      });
    });
  });

  describe('non-type-guard functions', () => {
    it('should return undefined for regular function', () => {
      const typeGuard = parseTypeGuard(`
        function add(a: number, b: number): number {
          return a + b;
        }
      `);
      expect(typeGuard).toBeUndefined();
    });

    it('should return undefined for void function', () => {
      const typeGuard = parseTypeGuard(`
        function log(message: string): void {
          console.log(message);
        }
      `);
      expect(typeGuard).toBeUndefined();
    });

    it('should return undefined for function without return type', () => {
      const typeGuard = parseTypeGuard(`
        function getData() {
          return 'data';
        }
      `);
      expect(typeGuard).toBeUndefined();
    });

    it('should return undefined for regular method', () => {
      const typeGuard = parseMethodTypeGuard(`
        class Service {
          process(data: string): boolean {
            return data.length > 0;
          }
        }
      `);
      expect(typeGuard).toBeUndefined();
    });
  });
});
