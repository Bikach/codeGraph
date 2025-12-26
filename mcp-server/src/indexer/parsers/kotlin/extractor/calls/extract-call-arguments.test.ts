import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode, findChildByType } from '../ast-utils/index.js';
import { extractCallArguments } from './extract-call-arguments.js';

function findCallSuffix(source: string) {
  const tree = parseKotlin(source);
  let callSuffix: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'call_suffix' && !callSuffix) {
      callSuffix = node;
    }
  });
  return callSuffix;
}

describe('extractCallArguments', () => {
  describe('argument count', () => {
    it('should count zero arguments', () => {
      const node = findCallSuffix('fun test() { noArgs() }');
      const result = extractCallArguments(node!);
      expect(result.argumentCount).toBe(0);
    });

    it('should count single argument', () => {
      const node = findCallSuffix('fun test() { oneArg(1) }');
      const result = extractCallArguments(node!);
      expect(result.argumentCount).toBe(1);
    });

    it('should count multiple arguments', () => {
      const node = findCallSuffix('fun test() { multiArgs(1, 2, 3) }');
      const result = extractCallArguments(node!);
      expect(result.argumentCount).toBe(3);
    });
  });

  describe('argument types', () => {
    it('should infer Int type from integer literal', () => {
      const node = findCallSuffix('fun test() { func(42) }');
      const result = extractCallArguments(node!);
      expect(result.argumentTypes).toContain('Int');
    });

    it('should infer String type from string literal', () => {
      const node = findCallSuffix('fun test() { func("hello") }');
      const result = extractCallArguments(node!);
      expect(result.argumentTypes).toContain('String');
    });

    it('should infer Boolean type from boolean literal', () => {
      const node = findCallSuffix('fun test() { func(true) }');
      const result = extractCallArguments(node!);
      expect(result.argumentTypes).toContain('Boolean');
    });

    it('should infer Double type from float literal', () => {
      const node = findCallSuffix('fun test() { func(3.14) }');
      const result = extractCallArguments(node!);
      expect(result.argumentTypes).toContain('Double');
    });

    it('should return unknown for complex expressions', () => {
      const node = findCallSuffix('fun test() { func(someVar) }');
      const result = extractCallArguments(node!);
      expect(result.argumentTypes).toContain('Unknown');
    });
  });
});
