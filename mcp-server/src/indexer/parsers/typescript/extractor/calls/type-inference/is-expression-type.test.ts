import { describe, it, expect } from 'vitest';
import { isExpressionType } from './is-expression-type.js';

describe('isExpressionType', () => {
  describe('literal types', () => {
    it('should return true for number', () => {
      expect(isExpressionType('number')).toBe(true);
    });

    it('should return true for string', () => {
      expect(isExpressionType('string')).toBe(true);
    });

    it('should return true for true/false', () => {
      expect(isExpressionType('true')).toBe(true);
      expect(isExpressionType('false')).toBe(true);
    });

    it('should return true for null', () => {
      expect(isExpressionType('null')).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isExpressionType('undefined')).toBe(true);
    });

    it('should return true for regex', () => {
      expect(isExpressionType('regex')).toBe(true);
    });

    it('should return true for template_string', () => {
      expect(isExpressionType('template_string')).toBe(true);
    });
  });

  describe('expression types', () => {
    it('should return true for identifier', () => {
      expect(isExpressionType('identifier')).toBe(true);
    });

    it('should return true for call_expression', () => {
      expect(isExpressionType('call_expression')).toBe(true);
    });

    it('should return true for member_expression', () => {
      expect(isExpressionType('member_expression')).toBe(true);
    });

    it('should return true for new_expression', () => {
      expect(isExpressionType('new_expression')).toBe(true);
    });

    it('should return true for binary_expression', () => {
      expect(isExpressionType('binary_expression')).toBe(true);
    });

    it('should return true for unary_expression', () => {
      expect(isExpressionType('unary_expression')).toBe(true);
    });

    it('should return true for ternary_expression', () => {
      expect(isExpressionType('ternary_expression')).toBe(true);
    });

    it('should return true for parenthesized_expression', () => {
      expect(isExpressionType('parenthesized_expression')).toBe(true);
    });

    it('should return true for arrow_function', () => {
      expect(isExpressionType('arrow_function')).toBe(true);
    });

    it('should return true for function_expression', () => {
      expect(isExpressionType('function_expression')).toBe(true);
    });

    it('should return true for object', () => {
      expect(isExpressionType('object')).toBe(true);
    });

    it('should return true for array', () => {
      expect(isExpressionType('array')).toBe(true);
    });

    it('should return true for await_expression', () => {
      expect(isExpressionType('await_expression')).toBe(true);
    });

    it('should return true for as_expression', () => {
      expect(isExpressionType('as_expression')).toBe(true);
    });
  });

  describe('non-expression types', () => {
    it('should return false for statement types', () => {
      expect(isExpressionType('if_statement')).toBe(false);
      expect(isExpressionType('for_statement')).toBe(false);
      expect(isExpressionType('while_statement')).toBe(false);
      expect(isExpressionType('return_statement')).toBe(false);
    });

    it('should return false for declaration types', () => {
      expect(isExpressionType('function_declaration')).toBe(false);
      expect(isExpressionType('class_declaration')).toBe(false);
      expect(isExpressionType('variable_declaration')).toBe(false);
    });

    it('should return false for punctuation', () => {
      expect(isExpressionType('(')).toBe(false);
      expect(isExpressionType(')')).toBe(false);
      expect(isExpressionType(',')).toBe(false);
      expect(isExpressionType(';')).toBe(false);
    });

    it('should return false for unknown types', () => {
      expect(isExpressionType('unknown_type')).toBe(false);
      expect(isExpressionType('')).toBe(false);
    });
  });
});
