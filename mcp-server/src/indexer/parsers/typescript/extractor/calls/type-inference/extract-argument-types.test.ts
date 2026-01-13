import { describe, it, expect, beforeAll } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { extractArgumentTypes } from './extract-argument-types.js';

describe('extractArgumentTypes', () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  function parseArguments(code: string): Parser.SyntaxNode {
    // Parse a call expression to get the arguments node
    const tree = parser.parse(`fn${code};`);
    // Navigate: program > expression_statement > call_expression > arguments
    const callExpr = tree.rootNode.children[0]?.children[0];
    const args = callExpr?.children.find((c) => c.type === 'arguments');
    if (!args) throw new Error(`Could not parse arguments: ${code}`);
    return args;
  }

  describe('empty arguments', () => {
    it('should return empty array for no arguments', () => {
      const args = parseArguments('()');
      expect(extractArgumentTypes(args)).toEqual([]);
    });
  });

  describe('single argument', () => {
    it('should infer number type', () => {
      const args = parseArguments('(42)');
      expect(extractArgumentTypes(args)).toEqual(['number']);
    });

    it('should infer string type', () => {
      const args = parseArguments('("hello")');
      expect(extractArgumentTypes(args)).toEqual(['string']);
    });

    it('should infer boolean type', () => {
      const args = parseArguments('(true)');
      expect(extractArgumentTypes(args)).toEqual(['boolean']);
    });

    it('should infer null type', () => {
      const args = parseArguments('(null)');
      expect(extractArgumentTypes(args)).toEqual(['null']);
    });

    it('should infer undefined type', () => {
      const args = parseArguments('(undefined)');
      expect(extractArgumentTypes(args)).toEqual(['undefined']);
    });
  });

  describe('multiple arguments', () => {
    it('should infer types for all arguments', () => {
      const args = parseArguments('(42, "hello", true)');
      expect(extractArgumentTypes(args)).toEqual(['number', 'string', 'boolean']);
    });

    it('should handle mixed known and unknown types', () => {
      const args = parseArguments('(42, variable, "hello")');
      expect(extractArgumentTypes(args)).toEqual(['number', 'unknown', 'string']);
    });

    it('should infer types for many arguments', () => {
      const args = parseArguments('(1, 2, 3, 4, 5)');
      expect(extractArgumentTypes(args)).toEqual([
        'number',
        'number',
        'number',
        'number',
        'number',
      ]);
    });
  });

  describe('complex argument types', () => {
    it('should infer array type', () => {
      const args = parseArguments('([1, 2, 3])');
      expect(extractArgumentTypes(args)).toEqual(['Array<number>']);
    });

    it('should infer object type', () => {
      const args = parseArguments('({ name: "John" })');
      expect(extractArgumentTypes(args)).toEqual(['object']);
    });

    it('should infer Function type for arrow function', () => {
      const args = parseArguments('(() => 42)');
      expect(extractArgumentTypes(args)).toEqual(['Function']);
    });

    it('should infer class name from new expression', () => {
      const args = parseArguments('(new User())');
      expect(extractArgumentTypes(args)).toEqual(['User']);
    });

    it('should infer RegExp type from regex', () => {
      const args = parseArguments('(/abc/g)');
      expect(extractArgumentTypes(args)).toEqual(['RegExp']);
    });
  });

  describe('expression arguments', () => {
    it('should infer number from arithmetic expression', () => {
      const args = parseArguments('(1 + 2)');
      expect(extractArgumentTypes(args)).toEqual(['number']);
    });

    it('should infer boolean from comparison', () => {
      const args = parseArguments('(a === b)');
      expect(extractArgumentTypes(args)).toEqual(['boolean']);
    });

    it('should infer string from string concatenation', () => {
      const args = parseArguments('("hello" + "world")');
      expect(extractArgumentTypes(args)).toEqual(['string']);
    });
  });

  describe('template literals', () => {
    it('should infer string from template literal', () => {
      const args = parseArguments('(`hello ${name}`)');
      expect(extractArgumentTypes(args)).toEqual(['string']);
    });
  });

  describe('bigint', () => {
    it('should infer bigint from bigint literal', () => {
      const args = parseArguments('(42n)');
      expect(extractArgumentTypes(args)).toEqual(['bigint']);
    });
  });

  describe('type assertions', () => {
    it('should infer asserted type from as expression', () => {
      const args = parseArguments('(value as string)');
      expect(extractArgumentTypes(args)).toEqual(['string']);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle console.log-like call', () => {
      const args = parseArguments('("User:", user, "Age:", 25)');
      expect(extractArgumentTypes(args)).toEqual(['string', 'unknown', 'string', 'number']);
    });

    it('should handle array method callback', () => {
      const args = parseArguments('((item) => item.id)');
      expect(extractArgumentTypes(args)).toEqual(['Function']);
    });

    it('should handle Promise.resolve-like call', () => {
      const args = parseArguments('({ data: [1, 2, 3], status: "ok" })');
      expect(extractArgumentTypes(args)).toEqual(['object']);
    });

    it('should handle fetch-like call', () => {
      const args = parseArguments('("https://api.example.com", { method: "POST" })');
      expect(extractArgumentTypes(args)).toEqual(['string', 'object']);
    });
  });
});
