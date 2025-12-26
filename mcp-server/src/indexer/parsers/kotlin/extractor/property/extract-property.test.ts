import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractProperty } from './extract-property.js';

function findPropertyDeclaration(source: string) {
  const tree = parseKotlin(source);
  let propDecl: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'property_declaration' && !propDecl) {
      propDecl = node;
    }
  });
  return propDecl;
}

describe('extractProperty', () => {
  describe('basic extraction', () => {
    it('should extract val property name', () => {
      const node = findPropertyDeclaration('val name: String = "test"');
      const prop = extractProperty(node!);
      expect(prop.name).toBe('name');
    });

    it('should extract var property name', () => {
      const node = findPropertyDeclaration('var count: Int = 0');
      const prop = extractProperty(node!);
      expect(prop.name).toBe('count');
    });

    it('should detect val property', () => {
      const node = findPropertyDeclaration('val immutable: String = "test"');
      const prop = extractProperty(node!);
      expect(prop.isVal).toBe(true);
    });

    it('should detect var property', () => {
      const node = findPropertyDeclaration('var mutable: Int = 0');
      const prop = extractProperty(node!);
      expect(prop.isVal).toBe(false);
    });
  });

  describe('type extraction', () => {
    it('should extract simple type', () => {
      const node = findPropertyDeclaration('val name: String = "test"');
      const prop = extractProperty(node!);
      expect(prop.type).toBe('String');
    });

    it('should extract nullable type', () => {
      const node = findPropertyDeclaration('val user: User? = null');
      const prop = extractProperty(node!);
      expect(prop.type).toBe('User?');
    });

    it('should extract generic type', () => {
      const node = findPropertyDeclaration('val items: List<String> = emptyList()');
      const prop = extractProperty(node!);
      expect(prop.type).toBe('List<String>');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const node = findPropertyDeclaration('val name: String = "test"');
      const prop = extractProperty(node!);
      expect(prop.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findPropertyDeclaration('private val secret: String = "hidden"');
      const prop = extractProperty(node!);
      expect(prop.visibility).toBe('private');
    });

    it('should extract internal visibility', () => {
      const node = findPropertyDeclaration('internal val config: Config = Config()');
      const prop = extractProperty(node!);
      expect(prop.visibility).toBe('internal');
    });
  });

  describe('initializer', () => {
    it('should extract lazy delegate', () => {
      const node = findPropertyDeclaration('val heavy by lazy { compute() }');
      const prop = extractProperty(node!);
      expect(prop.initializer).toContain('lazy');
    });

    it('should extract map delegate', () => {
      const node = findPropertyDeclaration('val name: String by map');
      const prop = extractProperty(node!);
      expect(prop.initializer).toBe('by map');
    });
  });

  describe('annotations', () => {
    it('should extract property annotation', () => {
      const node = findPropertyDeclaration('@Inject val repo: Repository = Repository()');
      const prop = extractProperty(node!);
      expect(prop.annotations.length).toBeGreaterThan(0);
      expect(prop.annotations[0]?.name).toBe('Inject');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findPropertyDeclaration('val name: String = "test"');
      const prop = extractProperty(node!);
      expect(prop.location).toBeDefined();
      expect(prop.location.startLine).toBeGreaterThan(0);
    });
  });
});
