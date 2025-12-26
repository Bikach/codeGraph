import { describe, it, expect } from 'vitest';
import { isExpressionType } from './is-expression-type.js';

describe('isExpressionType', () => {
  it('should return true for literal types', () => {
    expect(isExpressionType('integer_literal')).toBe(true);
    expect(isExpressionType('long_literal')).toBe(true);
    expect(isExpressionType('real_literal')).toBe(true);
    expect(isExpressionType('string_literal')).toBe(true);
    expect(isExpressionType('character_literal')).toBe(true);
    expect(isExpressionType('boolean_literal')).toBe(true);
    expect(isExpressionType('null_literal')).toBe(true);
  });

  it('should return true for expression types', () => {
    expect(isExpressionType('call_expression')).toBe(true);
    expect(isExpressionType('navigation_expression')).toBe(true);
    expect(isExpressionType('simple_identifier')).toBe(true);
  });

  it('should return true for operator expressions', () => {
    expect(isExpressionType('prefix_expression')).toBe(true);
    expect(isExpressionType('postfix_expression')).toBe(true);
    expect(isExpressionType('additive_expression')).toBe(true);
    expect(isExpressionType('multiplicative_expression')).toBe(true);
  });

  it('should return true for control flow expressions', () => {
    expect(isExpressionType('if_expression')).toBe(true);
    expect(isExpressionType('when_expression')).toBe(true);
    expect(isExpressionType('try_expression')).toBe(true);
  });

  it('should return true for lambda and collection literals', () => {
    expect(isExpressionType('lambda_literal')).toBe(true);
    expect(isExpressionType('object_literal')).toBe(true);
    expect(isExpressionType('collection_literal')).toBe(true);
  });

  it('should return false for non-expression types', () => {
    expect(isExpressionType('class_declaration')).toBe(false);
    expect(isExpressionType('function_declaration')).toBe(false);
    expect(isExpressionType('modifiers')).toBe(false);
    expect(isExpressionType('type_identifier')).toBe(false);
  });
});
