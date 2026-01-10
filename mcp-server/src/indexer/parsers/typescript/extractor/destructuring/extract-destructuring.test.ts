import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode, findChildByType } from '../ast-utils/index.js';
import { extractDestructuring, isDestructuringDeclarator } from './extract-destructuring.js';
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

describe('isDestructuringDeclarator', () => {
  it('should return true for object destructuring', () => {
    const declarator = findVariableDeclarator('const { name, age } = user');
    expect(declarator).toBeDefined();
    expect(isDestructuringDeclarator(declarator!)).toBe(true);
  });

  it('should return true for array destructuring', () => {
    const declarator = findVariableDeclarator('const [first, second] = array');
    expect(declarator).toBeDefined();
    expect(isDestructuringDeclarator(declarator!)).toBe(true);
  });

  it('should return false for regular variable', () => {
    const declarator = findVariableDeclarator('const value = 42');
    expect(declarator).toBeDefined();
    expect(isDestructuringDeclarator(declarator!)).toBe(false);
  });

  it('should return false for function assignment', () => {
    const declarator = findVariableDeclarator('const fn = () => {}');
    expect(declarator).toBeDefined();
    expect(isDestructuringDeclarator(declarator!)).toBe(false);
  });
});

describe('extractDestructuring', () => {
  describe('object destructuring', () => {
    it('should extract component names from simple object destructuring', () => {
      const declaration = findLexicalDeclaration('const { name, age } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');
      expect(declarator).toBeDefined();

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toEqual(['name', 'age']);
    });

    it('should extract three components', () => {
      const declaration = findLexicalDeclaration('const { a, b, c } = obj');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.componentNames).toHaveLength(3);
      expect(result?.componentNames).toEqual(['a', 'b', 'c']);
    });

    it('should handle renaming (aliasing)', () => {
      const declaration = findLexicalDeclaration('const { name: userName, age: userAge } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toEqual(['userName', 'userAge']);
    });

    it('should handle default values', () => {
      const declaration = findLexicalDeclaration('const { name = "default", age = 0 } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toContain('name');
      expect(result?.componentNames).toContain('age');
    });

    it('should handle rest pattern', () => {
      const declaration = findLexicalDeclaration('const { name, ...rest } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toContain('name');
      expect(result?.componentNames).toContain('rest');
    });

    it('should return undefined for non-destructuring', () => {
      const declaration = findLexicalDeclaration('const name = "test"');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeUndefined();
    });
  });

  describe('array destructuring', () => {
    it('should extract component names from array destructuring', () => {
      const declaration = findLexicalDeclaration('const [first, second] = array');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toEqual(['first', 'second']);
    });

    it('should handle array rest pattern', () => {
      const declaration = findLexicalDeclaration('const [first, ...rest] = array');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toContain('first');
      expect(result?.componentNames).toContain('rest');
    });

    it('should handle array default values', () => {
      const declaration = findLexicalDeclaration('const [first = 1, second = 2] = array');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toEqual(['first', 'second']);
    });
  });

  describe('const vs let', () => {
    it('should detect const declaration as immutable', () => {
      const declaration = findLexicalDeclaration('const { name } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.isVal).toBe(true);
    });

    it('should detect let declaration as mutable', () => {
      const declaration = findLexicalDeclaration('let { name } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.isVal).toBe(false);
    });
  });

  describe('initializer', () => {
    it('should extract initializer for object destructuring', () => {
      const declaration = findLexicalDeclaration('const { name } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.initializer).toBe('user');
    });

    it('should extract complex initializer', () => {
      const declaration = findLexicalDeclaration('const { name } = getUser()');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.initializer).toBe('getUser()');
    });

    it('should extract initializer for array destructuring', () => {
      const declaration = findLexicalDeclaration('const [first] = items');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.initializer).toBe('items');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const declaration = findLexicalDeclaration('const { name } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.visibility).toBe('public');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const declaration = findLexicalDeclaration('const { name } = user');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result?.location).toBeDefined();
      expect(result?.location.startLine).toBeGreaterThan(0);
    });
  });

  describe('nested destructuring', () => {
    it('should handle nested object destructuring', () => {
      const declaration = findLexicalDeclaration('const { user: { name, age } } = data');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toContain('name');
      expect(result?.componentNames).toContain('age');
    });

    it('should handle object in array destructuring', () => {
      const declaration = findLexicalDeclaration('const [{ name }] = users');
      const declarator = findChildByType(declaration!, 'variable_declarator');

      const result = extractDestructuring(declaration!, declarator!);
      expect(result).toBeDefined();
      expect(result?.componentNames).toContain('name');
    });
  });
});
