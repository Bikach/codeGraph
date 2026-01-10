import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractVariable, isVariableFunction } from './extract-variable.js';
import type { SyntaxNode } from 'tree-sitter';

function findLexicalDeclaration(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let decl: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if ((node.type === 'lexical_declaration' || node.type === 'variable_declaration') && !decl) {
      decl = node;
    }
  });
  return decl;
}

function findVariableDeclarator(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let declarator: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'variable_declarator' && !declarator) {
      declarator = node;
    }
  });
  return declarator;
}

describe('extractVariable', () => {
  describe('const variables', () => {
    it('should extract const variable name', () => {
      const node = findLexicalDeclaration('const name = "test"');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props).toHaveLength(1);
      expect(props[0]?.name).toBe('name');
    });

    it('should mark const as immutable (isVal = true)', () => {
      const node = findLexicalDeclaration('const value = 42');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.isVal).toBe(true);
    });

    it('should extract const with type annotation', () => {
      const node = findLexicalDeclaration('const count: number = 10');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.name).toBe('count');
      expect(props[0]?.type).toBe('number');
    });

    it('should extract initializer', () => {
      const node = findLexicalDeclaration('const message = "hello"');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.initializer).toBe('"hello"');
    });
  });

  describe('let variables', () => {
    it('should extract let variable name', () => {
      const node = findLexicalDeclaration('let name = "test"');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props).toHaveLength(1);
      expect(props[0]?.name).toBe('name');
    });

    it('should mark let as mutable (isVal = false)', () => {
      const node = findLexicalDeclaration('let value = 42');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.isVal).toBe(false);
    });

    it('should extract let with type annotation', () => {
      const node = findLexicalDeclaration('let count: number');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.name).toBe('count');
      expect(props[0]?.type).toBe('number');
    });
  });

  describe('multiple declarations', () => {
    it('should extract multiple variables from single declaration', () => {
      const node = findLexicalDeclaration('const a = 1, b = 2, c = 3');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props).toHaveLength(3);
      expect(props[0]?.name).toBe('a');
      expect(props[1]?.name).toBe('b');
      expect(props[2]?.name).toBe('c');
    });
  });

  describe('complex types', () => {
    it('should extract array type', () => {
      const node = findLexicalDeclaration('const items: string[] = []');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.type).toBe('string[]');
    });

    it('should extract generic type', () => {
      const node = findLexicalDeclaration('const map: Map<string, number> = new Map()');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.type).toBe('Map<string, number>');
    });

    it('should extract union type', () => {
      const node = findLexicalDeclaration('const value: string | null = null');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.type).toBe('string | null');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findLexicalDeclaration('const test = 1');
      expect(node).toBeDefined();
      const props = extractVariable(node!);
      expect(props[0]?.location).toBeDefined();
      expect(props[0]?.location.startLine).toBeGreaterThan(0);
    });
  });
});

describe('isVariableFunction', () => {
  it('should return true for arrow function assignment', () => {
    const declarator = findVariableDeclarator('const fn = () => {}');
    expect(declarator).toBeDefined();
    expect(isVariableFunction(declarator!)).toBe(true);
  });

  it('should return true for function expression assignment', () => {
    const declarator = findVariableDeclarator('const fn = function() {}');
    expect(declarator).toBeDefined();
    expect(isVariableFunction(declarator!)).toBe(true);
  });

  it('should return false for non-function assignment', () => {
    const declarator = findVariableDeclarator('const value = 42');
    expect(declarator).toBeDefined();
    expect(isVariableFunction(declarator!)).toBe(false);
  });

  it('should return false for object assignment', () => {
    const declarator = findVariableDeclarator('const obj = { key: "value" }');
    expect(declarator).toBeDefined();
    expect(isVariableFunction(declarator!)).toBe(false);
  });
});
