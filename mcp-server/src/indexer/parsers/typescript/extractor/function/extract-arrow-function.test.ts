import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode, findChildByType } from '../ast-utils/index.js';
import { extractArrowFunction, isArrowFunctionDeclarator, getArrowFunction } from './extract-arrow-function.js';
import type { SyntaxNode } from 'tree-sitter';

function findVariableDeclarator(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let declarator: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'variable_declarator' && !declarator) {
      // Check if it contains an arrow function
      if (findChildByType(node, 'arrow_function')) {
        declarator = node;
      }
    }
  });
  return declarator;
}

describe('extractArrowFunction', () => {
  describe('basic extraction', () => {
    it('should extract arrow function name from declarator', () => {
      const declarator = findVariableDeclarator('const greet = () => {}');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.name).toBe('greet');
    });

    it('should extract arrow function with parameters', () => {
      const declarator = findVariableDeclarator('const add = (a: number, b: number) => a + b');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0]?.name).toBe('a');
      expect(func.parameters[0]?.type).toBe('number');
    });

    it('should extract return type', () => {
      const declarator = findVariableDeclarator('const getValue = (): string => "test"');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.returnType).toBe('string');
    });

    it('should handle arrow function without explicit return type', () => {
      const declarator = findVariableDeclarator('const noReturn = () => console.log("hi")');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.returnType).toBeUndefined();
    });
  });

  describe('single parameter arrow functions', () => {
    it('should extract single parameter without parens', () => {
      const declarator = findVariableDeclarator('const double = x => x * 2');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.parameters).toHaveLength(1);
      expect(func.parameters[0]?.name).toBe('x');
    });
  });

  describe('async arrow functions', () => {
    it('should detect async arrow function', () => {
      const declarator = findVariableDeclarator('const fetchData = async () => {}');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.isSuspend).toBe(true);
    });

    it('should extract async arrow function with return type', () => {
      const declarator = findVariableDeclarator('const fetchUser = async (): Promise<User> => new User()');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.isSuspend).toBe(true);
      expect(func.returnType).toBe('Promise<User>');
    });
  });

  describe('generic arrow functions', () => {
    it('should extract type parameters', () => {
      const declarator = findVariableDeclarator('const identity = <T>(value: T): T => value');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.typeParameters).toHaveLength(1);
      expect(func.typeParameters![0]?.name).toBe('T');
    });
  });

  describe('function calls extraction', () => {
    it('should extract calls from arrow function body', () => {
      const declarator = findVariableDeclarator('const process = () => { console.log("hi"); doWork(); }');
      expect(declarator).toBeDefined();
      const arrowFunc = getArrowFunction(declarator!);
      expect(arrowFunc).toBeDefined();
      const func = extractArrowFunction(declarator!, arrowFunc!);
      expect(func.calls.length).toBeGreaterThan(0);
    });
  });
});

describe('isArrowFunctionDeclarator', () => {
  it('should return true for arrow function declarator', () => {
    const declarator = findVariableDeclarator('const fn = () => {}');
    expect(declarator).toBeDefined();
    expect(isArrowFunctionDeclarator(declarator!)).toBe(true);
  });
});
