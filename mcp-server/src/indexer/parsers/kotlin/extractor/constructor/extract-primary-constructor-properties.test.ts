import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractPrimaryConstructorProperties } from './extract-primary-constructor-properties.js';

function findClassDeclaration(source: string) {
  const tree = parseKotlin(source);
  return findChildByType(tree.rootNode, 'class_declaration');
}

describe('extractPrimaryConstructorProperties', () => {
  describe('val properties', () => {
    it('should extract val property from constructor', () => {
      const node = findClassDeclaration('class User(val name: String)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(1);
      expect(props[0]?.name).toBe('name');
      expect(props[0]?.isVal).toBe(true);
    });

    it('should extract multiple val properties', () => {
      const node = findClassDeclaration('class User(val id: Int, val name: String)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(2);
    });
  });

  describe('var properties', () => {
    it('should extract var property from constructor', () => {
      const node = findClassDeclaration('class Counter(var count: Int)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(1);
      expect(props[0]?.isVal).toBe(false);
    });
  });

  describe('non-property parameters', () => {
    it('should not extract regular parameters (no val/var)', () => {
      const node = findClassDeclaration('class Service(config: Config)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(0);
    });

    it('should only extract val/var parameters', () => {
      const node = findClassDeclaration('class Service(val repo: Repository, config: Config)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(1);
      expect(props[0]?.name).toBe('repo');
    });
  });

  describe('types', () => {
    it('should extract property type', () => {
      const node = findClassDeclaration('class User(val name: String)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props[0]?.type).toBe('String');
    });

    it('should extract nullable type', () => {
      const node = findClassDeclaration('class User(val email: String?)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props[0]?.type).toBe('String?');
    });
  });

  describe('visibility', () => {
    it('should extract private visibility', () => {
      const node = findClassDeclaration('class User(private val id: String)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props[0]?.visibility).toBe('private');
    });

    it('should default to public visibility', () => {
      const node = findClassDeclaration('class User(val id: String)');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props[0]?.visibility).toBe('public');
    });
  });

  describe('no primary constructor', () => {
    it('should return empty array for class without constructor', () => {
      const node = findClassDeclaration('class Empty');
      const props = extractPrimaryConstructorProperties(node!);
      expect(props).toHaveLength(0);
    });
  });
});
