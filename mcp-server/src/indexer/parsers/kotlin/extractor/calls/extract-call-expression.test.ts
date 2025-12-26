import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractCallExpression } from './extract-call-expression.js';

function findCallExpression(source: string) {
  const tree = parseKotlin(source);
  let callExpr: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'call_expression' && !callExpr) {
      callExpr = node;
    }
  });
  return callExpr;
}

describe('extractCallExpression', () => {
  describe('simple calls', () => {
    it('should extract direct function call', () => {
      const node = findCallExpression('fun test() { println("hello") }');
      const call = extractCallExpression(node!);
      expect(call?.name).toBe('println');
      expect(call?.receiver).toBeUndefined();
    });

    it('should extract argument count', () => {
      const node = findCallExpression('fun test() { add(1, 2, 3) }');
      const call = extractCallExpression(node!);
      expect(call?.argumentCount).toBe(3);
    });
  });

  describe('method calls', () => {
    it('should extract receiver', () => {
      const node = findCallExpression('fun test() { repo.save(data) }');
      const call = extractCallExpression(node!);
      expect(call?.name).toBe('save');
      expect(call?.receiver).toBe('repo');
    });
  });

  describe('qualified calls', () => {
    it('should extract full qualified receiver', () => {
      const node = findCallExpression('fun test() { com.example.Utils.format("test") }');
      const call = extractCallExpression(node!);
      expect(call?.name).toBe('format');
      expect(call?.receiver).toBe('com.example.Utils');
    });
  });

  describe('safe calls', () => {
    it('should detect safe call operator', () => {
      const node = findCallExpression('fun test() { service?.process() }');
      const call = extractCallExpression(node!);
      expect(call?.isSafeCall).toBe(true);
    });
  });

  describe('location', () => {
    it('should include location', () => {
      const node = findCallExpression('fun test() { doWork() }');
      const call = extractCallExpression(node!);
      expect(call?.location).toBeDefined();
    });
  });
});
