import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../../parser.js';
import { traverseNode } from '../../ast-utils/index.js';
import { inferArgumentType } from './infer-argument-type.js';
import type { SyntaxNode } from 'tree-sitter';

describe('inferArgumentType', () => {
  function getValueArguments(code: string): SyntaxNode[] {
    const tree = parseKotlin(code);
    const args: SyntaxNode[] = [];
    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'value_argument') {
        args.push(node);
      }
    });
    return args;
  }

  it('should infer Int for integer argument', () => {
    const args = getValueArguments('foo(42)');
    expect(inferArgumentType(args[0]!)).toBe('Int');
  });

  it('should infer String for string argument', () => {
    const args = getValueArguments('foo("hello")');
    expect(inferArgumentType(args[0]!)).toBe('String');
  });

  it('should infer Boolean for boolean argument', () => {
    const args = getValueArguments('foo(true)');
    expect(inferArgumentType(args[0]!)).toBe('Boolean');
  });

  it('should infer type for named argument', () => {
    const args = getValueArguments('foo(x = 42)');
    expect(inferArgumentType(args[0]!)).toBe('Int');
  });

  it('should infer Unknown for complex expression', () => {
    const args = getValueArguments('foo(bar())');
    expect(inferArgumentType(args[0]!)).toBe('Unknown');
  });

  it('should infer types for multiple arguments', () => {
    const args = getValueArguments('foo(42, "hello", true)');
    expect(inferArgumentType(args[0]!)).toBe('Int');
    expect(inferArgumentType(args[1]!)).toBe('String');
    expect(inferArgumentType(args[2]!)).toBe('Boolean');
  });
});
