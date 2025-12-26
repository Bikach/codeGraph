import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../../parser.js';
import { findChildByType, traverseNode } from '../../ast-utils/index.js';
import { findFirstExpression } from './find-first-expression.js';

describe('findFirstExpression', () => {
  function getValueArgument(code: string) {
    const tree = parseKotlin(code);
    let found: ReturnType<typeof findChildByType> = undefined;
    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'value_argument' && !found) {
        found = node;
      }
    });
    return found;
  }

  it('should find positional argument expression', () => {
    const arg = getValueArgument('foo(42)');
    const expr = findFirstExpression(arg!);
    expect(expr).toBeDefined();
    expect(expr!.type).toBe('integer_literal');
  });

  it('should find named argument expression', () => {
    const arg = getValueArgument('foo(x = 42)');
    const expr = findFirstExpression(arg!);
    expect(expr).toBeDefined();
    expect(expr!.type).toBe('integer_literal');
  });

  it('should find string argument expression', () => {
    const arg = getValueArgument('foo("hello")');
    const expr = findFirstExpression(arg!);
    expect(expr).toBeDefined();
    expect(expr!.type).toBe('string_literal');
  });

  it('should find call expression argument', () => {
    const arg = getValueArgument('foo(bar())');
    const expr = findFirstExpression(arg!);
    expect(expr).toBeDefined();
    expect(expr!.type).toBe('call_expression');
  });

  it('should find lambda argument', () => {
    const arg = getValueArgument('foo({ it })');
    const expr = findFirstExpression(arg!);
    expect(expr).toBeDefined();
    expect(expr!.type).toBe('lambda_literal');
  });
});
