import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractParameters } from './extract-parameters.js';
import type { SyntaxNode } from 'tree-sitter';

function findFormalParameters(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let params: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'formal_parameters' && !params) {
      params = node;
    }
  });
  return params;
}

describe('extractParameters', () => {
  describe('required parameters', () => {
    it('should extract parameter name', () => {
      const params = findFormalParameters('function test(name) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('name');
    });

    it('should extract parameter type', () => {
      const params = findFormalParameters('function test(name: string) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('name');
      expect(result[0]?.type).toBe('string');
    });

    it('should extract multiple parameters', () => {
      const params = findFormalParameters('function test(a: number, b: string, c: boolean) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('a');
      expect(result[0]?.type).toBe('number');
      expect(result[1]?.name).toBe('b');
      expect(result[1]?.type).toBe('string');
      expect(result[2]?.name).toBe('c');
      expect(result[2]?.type).toBe('boolean');
    });

    it('should extract complex type', () => {
      const params = findFormalParameters('function test(users: Array<User>) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('Array<User>');
    });

    it('should extract union type', () => {
      const params = findFormalParameters('function test(value: string | number) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('string | number');
    });
  });

  describe('optional parameters', () => {
    it('should extract optional parameter', () => {
      const params = findFormalParameters('function test(name?: string) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('name');
      expect(result[0]?.type).toBe('string');
    });
  });

  describe('parameters with default values', () => {
    it('should extract default value', () => {
      const params = findFormalParameters('function test(count = 10) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('count');
      expect(result[0]?.defaultValue).toBe('10');
    });

    it('should extract default value with type', () => {
      const params = findFormalParameters('function test(name: string = "default") {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('name');
      expect(result[0]?.type).toBe('string');
      expect(result[0]?.defaultValue).toBe('"default"');
    });
  });

  describe('rest parameters', () => {
    it('should extract rest parameter', () => {
      const params = findFormalParameters('function test(...args: string[]) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('args');
      expect(result[0]?.type).toBe('string[]');
    });

    it('should handle mixed parameters with rest', () => {
      const params = findFormalParameters('function test(first: string, ...rest: number[]) {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('first');
      expect(result[1]?.name).toBe('rest');
    });
  });

  describe('empty parameters', () => {
    it('should handle empty parameter list', () => {
      const params = findFormalParameters('function test() {}');
      expect(params).toBeDefined();
      const result = extractParameters(params!);
      expect(result).toHaveLength(0);
    });
  });
});
