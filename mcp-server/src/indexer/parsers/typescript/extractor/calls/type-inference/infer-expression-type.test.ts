import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../../parser.js';
import { inferExpressionType } from './infer-expression-type.js';
import type { SyntaxNode } from 'tree-sitter';

describe('inferExpressionType', () => {
  function parseExpression(code: string): SyntaxNode {
    // Wrap expression in a variable declaration to parse it
    const tree = parseTypeScript(`const x = ${code};`, '/test.ts');
    // Navigate: program > lexical_declaration > variable_declarator > value
    const declarator = tree.rootNode.children[0]?.children[1];
    const value = declarator?.children[2]; // After identifier and '='
    if (!value) throw new Error(`Could not parse expression: ${code}`);
    return value;
  }

  describe('numeric literals', () => {
    it('should infer number from integer', () => {
      const node = parseExpression('42');
      expect(inferExpressionType(node)).toBe('number');
    });

    it('should infer number from float', () => {
      const node = parseExpression('3.14');
      expect(inferExpressionType(node)).toBe('number');
    });

    it('should infer number from hex literal', () => {
      const node = parseExpression('0xFF');
      expect(inferExpressionType(node)).toBe('number');
    });

    it('should infer bigint from bigint literal', () => {
      const node = parseExpression('42n');
      expect(inferExpressionType(node)).toBe('bigint');
    });
  });

  describe('string literals', () => {
    it('should infer string from single-quoted string', () => {
      const node = parseExpression("'hello'");
      expect(inferExpressionType(node)).toBe('string');
    });

    it('should infer string from double-quoted string', () => {
      const node = parseExpression('"hello"');
      expect(inferExpressionType(node)).toBe('string');
    });

    it('should infer string from template string', () => {
      const node = parseExpression('`hello ${name}`');
      expect(inferExpressionType(node)).toBe('string');
    });
  });

  describe('boolean literals', () => {
    it('should infer boolean from true', () => {
      const node = parseExpression('true');
      expect(inferExpressionType(node)).toBe('boolean');
    });

    it('should infer boolean from false', () => {
      const node = parseExpression('false');
      expect(inferExpressionType(node)).toBe('boolean');
    });
  });

  describe('null and undefined', () => {
    it('should infer null from null', () => {
      const node = parseExpression('null');
      expect(inferExpressionType(node)).toBe('null');
    });

    it('should infer undefined from undefined', () => {
      const node = parseExpression('undefined');
      expect(inferExpressionType(node)).toBe('undefined');
    });
  });

  describe('regex', () => {
    it('should infer RegExp from regex literal', () => {
      const node = parseExpression('/abc/g');
      expect(inferExpressionType(node)).toBe('RegExp');
    });
  });

  describe('array literals', () => {
    it('should infer Array<number> from number array', () => {
      const node = parseExpression('[1, 2, 3]');
      expect(inferExpressionType(node)).toBe('Array<number>');
    });

    it('should infer Array<string> from string array', () => {
      const node = parseExpression('["a", "b", "c"]');
      expect(inferExpressionType(node)).toBe('Array<string>');
    });

    it('should infer Array<unknown> from empty array', () => {
      const node = parseExpression('[]');
      expect(inferExpressionType(node)).toBe('Array<unknown>');
    });

    it('should infer Array<unknown> from mixed array', () => {
      const node = parseExpression('[1, "a", true]');
      expect(inferExpressionType(node)).toBe('Array<unknown>');
    });
  });

  describe('object literals', () => {
    it('should infer object from object literal', () => {
      const node = parseExpression('{ name: "John" }');
      expect(inferExpressionType(node)).toBe('object');
    });

    it('should infer object from empty object', () => {
      const node = parseExpression('{}');
      expect(inferExpressionType(node)).toBe('object');
    });
  });

  describe('function expressions', () => {
    it('should infer Function from arrow function', () => {
      const node = parseExpression('() => 42');
      expect(inferExpressionType(node)).toBe('Function');
    });

    it('should infer Function from function expression', () => {
      const node = parseExpression('function() { return 42; }');
      expect(inferExpressionType(node)).toBe('Function');
    });
  });

  describe('new expressions', () => {
    it('should infer class name from new expression', () => {
      const node = parseExpression('new User()');
      expect(inferExpressionType(node)).toBe('User');
    });

    it('should infer class name from namespaced new expression', () => {
      const node = parseExpression('new Namespace.User()');
      expect(inferExpressionType(node)).toBe('User');
    });
  });

  describe('binary expressions', () => {
    it('should infer boolean from comparison', () => {
      const node = parseExpression('a === b');
      expect(inferExpressionType(node)).toBe('boolean');
    });

    it('should infer boolean from logical and', () => {
      const node = parseExpression('a && b');
      expect(inferExpressionType(node)).toBe('boolean');
    });

    it('should infer number from arithmetic', () => {
      const node = parseExpression('1 + 2');
      expect(inferExpressionType(node)).toBe('number');
    });

    it('should infer string from string concatenation', () => {
      const node = parseExpression('"hello" + "world"');
      expect(inferExpressionType(node)).toBe('string');
    });

    it('should infer number from bitwise operations', () => {
      const node = parseExpression('a | b');
      expect(inferExpressionType(node)).toBe('number');
    });
  });

  describe('unary expressions', () => {
    it('should infer boolean from negation', () => {
      const node = parseExpression('!value');
      expect(inferExpressionType(node)).toBe('boolean');
    });

    it('should infer string from typeof', () => {
      const node = parseExpression('typeof value');
      expect(inferExpressionType(node)).toBe('string');
    });

    it('should infer undefined from void', () => {
      const node = parseExpression('void 0');
      expect(inferExpressionType(node)).toBe('undefined');
    });

    it('should infer number from unary minus', () => {
      const node = parseExpression('-value');
      expect(inferExpressionType(node)).toBe('number');
    });
  });

  describe('parenthesized expressions', () => {
    it('should unwrap parenthesized expression', () => {
      const node = parseExpression('(42)');
      expect(inferExpressionType(node)).toBe('number');
    });

    it('should unwrap nested parenthesized expression', () => {
      const node = parseExpression('(("hello"))');
      expect(inferExpressionType(node)).toBe('string');
    });
  });

  describe('type assertions', () => {
    it('should infer type from as expression', () => {
      const node = parseExpression('value as string');
      expect(inferExpressionType(node)).toBe('string');
    });

    it('should infer type from as expression with complex type', () => {
      const node = parseExpression('value as User');
      expect(inferExpressionType(node)).toBe('User');
    });
  });

  describe('unknown types', () => {
    it('should return unknown for identifier', () => {
      const node = parseExpression('someVariable');
      expect(inferExpressionType(node)).toBe('unknown');
    });

    it('should return unknown for call expression', () => {
      const node = parseExpression('getUser()');
      expect(inferExpressionType(node)).toBe('unknown');
    });

    it('should return unknown for member expression', () => {
      const node = parseExpression('obj.property');
      expect(inferExpressionType(node)).toBe('unknown');
    });
  });
});
