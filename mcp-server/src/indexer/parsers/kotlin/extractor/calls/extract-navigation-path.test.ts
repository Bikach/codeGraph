import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractNavigationPath } from './extract-navigation-path.js';

function findNavigationExpression(source: string) {
  const tree = parseKotlin(source);
  let navExpr: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'navigation_expression' && !navExpr) {
      navExpr = node;
    }
  });
  return navExpr;
}

describe('extractNavigationPath', () => {
  describe('simple navigation', () => {
    it('should extract receiver and method name', () => {
      const node = findNavigationExpression('fun test() { obj.method() }');
      const result = extractNavigationPath(node!);
      expect(result.receiverPath).toBe('obj');
      expect(result.methodName).toBe('method');
    });
  });

  describe('qualified navigation', () => {
    it('should extract full qualified path', () => {
      const node = findNavigationExpression('fun test() { com.example.Utils.format() }');
      const result = extractNavigationPath(node!);
      expect(result.receiverPath).toBe('com.example.Utils');
      expect(result.methodName).toBe('format');
    });

    it('should handle deep nesting', () => {
      const node = findNavigationExpression('fun test() { a.b.c.d.method() }');
      const result = extractNavigationPath(node!);
      expect(result.receiverPath).toBe('a.b.c.d');
      expect(result.methodName).toBe('method');
    });
  });

  describe('safe call detection', () => {
    it('should detect safe call operator', () => {
      const node = findNavigationExpression('fun test() { obj?.method() }');
      const result = extractNavigationPath(node!);
      expect(result.hasSafeCall).toBe(true);
    });

    it('should not detect safe call on regular navigation', () => {
      const node = findNavigationExpression('fun test() { obj.method() }');
      const result = extractNavigationPath(node!);
      expect(result.hasSafeCall).toBe(false);
    });
  });
});
