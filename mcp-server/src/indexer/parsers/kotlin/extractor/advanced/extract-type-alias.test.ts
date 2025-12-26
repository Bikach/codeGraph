import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractTypeAlias } from './extract-type-alias.js';

function findTypeAliasDeclaration(source: string) {
  const tree = parseKotlin(source);
  let typeAlias: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'type_alias' && !typeAlias) {
      typeAlias = node;
    }
  });
  return typeAlias;
}

describe('extractTypeAlias', () => {
  describe('basic extraction', () => {
    it('should extract type alias name', () => {
      const node = findTypeAliasDeclaration('typealias StringList = List<String>');
      expect(node).toBeDefined();
      const alias = extractTypeAlias(node!);
      expect(alias.name).toBe('StringList');
    });

    it('should extract aliased type', () => {
      const node = findTypeAliasDeclaration('typealias StringList = List<String>');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('List<String>');
    });

    it('should extract simple aliased type', () => {
      const node = findTypeAliasDeclaration('typealias Name = String');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('String');
    });
  });

  describe('generic type aliases', () => {
    it('should extract type parameters', () => {
      const node = findTypeAliasDeclaration('typealias Predicate<T> = (T) -> Boolean');
      const alias = extractTypeAlias(node!);
      expect(alias.typeParameters).toBeDefined();
      expect(alias.typeParameters).toHaveLength(1);
      expect(alias.typeParameters![0]?.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = findTypeAliasDeclaration('typealias Transform<A, B> = (A) -> B');
      const alias = extractTypeAlias(node!);
      expect(alias.typeParameters).toHaveLength(2);
    });

    it('should have undefined typeParameters when none present', () => {
      const node = findTypeAliasDeclaration('typealias ID = Long');
      const alias = extractTypeAlias(node!);
      expect(alias.typeParameters).toBeUndefined();
    });
  });

  describe('function type aliases', () => {
    it('should extract function type', () => {
      const node = findTypeAliasDeclaration('typealias Handler = () -> Unit');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('() -> Unit');
    });

    it('should extract function type with parameters', () => {
      const node = findTypeAliasDeclaration('typealias Callback = (Int, String) -> Boolean');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toContain('->');
    });
  });

  describe('nullable type aliases', () => {
    it('should extract nullable aliased type', () => {
      const node = findTypeAliasDeclaration('typealias OptionalString = String?');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('String?');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const node = findTypeAliasDeclaration('typealias ID = Long');
      const alias = extractTypeAlias(node!);
      expect(alias.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findTypeAliasDeclaration('private typealias InternalId = Long');
      const alias = extractTypeAlias(node!);
      expect(alias.visibility).toBe('private');
    });

    it('should extract internal visibility', () => {
      const node = findTypeAliasDeclaration('internal typealias ModuleId = String');
      const alias = extractTypeAlias(node!);
      expect(alias.visibility).toBe('internal');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findTypeAliasDeclaration('typealias ID = Long');
      const alias = extractTypeAlias(node!);
      expect(alias.location).toBeDefined();
      expect(alias.location.startLine).toBeGreaterThan(0);
    });
  });

  describe('complex types', () => {
    it('should extract nested generic types', () => {
      const node = findTypeAliasDeclaration('typealias UserMap = Map<String, List<User>>');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('Map<String, List<User>>');
    });

    it('should extract qualified type names', () => {
      const node = findTypeAliasDeclaration('typealias Result = com.example.Result');
      const alias = extractTypeAlias(node!);
      expect(alias.aliasedType).toBe('com.example.Result');
    });
  });
});
