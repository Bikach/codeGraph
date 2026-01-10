import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractTypeAlias } from './extract-type-alias.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract a type alias from TypeScript source.
 */
function parseTypeAlias(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const typeAliasNode = findChildByType(tree.rootNode, 'type_alias_declaration');
  if (!typeAliasNode) throw new Error('No type alias found');
  return extractTypeAlias(typeAliasNode);
}

describe('extractTypeAlias', () => {
  describe('simple type aliases', () => {
    it('should extract type alias with primitive type', () => {
      const alias = parseTypeAlias(`type UserId = string;`);

      expect(alias.name).toBe('UserId');
      expect(alias.aliasedType).toBe('string');
      expect(alias.visibility).toBe('public');
    });

    it('should extract type alias with number type', () => {
      const alias = parseTypeAlias(`type Age = number;`);

      expect(alias.name).toBe('Age');
      expect(alias.aliasedType).toBe('number');
    });

    it('should extract type alias with boolean type', () => {
      const alias = parseTypeAlias(`type Flag = boolean;`);

      expect(alias.name).toBe('Flag');
      expect(alias.aliasedType).toBe('boolean');
    });
  });

  describe('object type aliases', () => {
    it('should extract type alias with object type', () => {
      const alias = parseTypeAlias(`type User = { name: string; age: number };`);

      expect(alias.name).toBe('User');
      expect(alias.aliasedType).toBe('{ name: string; age: number }');
    });

    it('should extract type alias with nested object', () => {
      const alias = parseTypeAlias(`type Config = { db: { host: string } };`);

      expect(alias.name).toBe('Config');
      expect(alias.aliasedType).toContain('db');
    });
  });

  describe('union and intersection types', () => {
    it('should extract union type alias', () => {
      const alias = parseTypeAlias(`type StringOrNumber = string | number;`);

      expect(alias.name).toBe('StringOrNumber');
      expect(alias.aliasedType).toBe('string | number');
    });

    it('should extract intersection type alias', () => {
      const alias = parseTypeAlias(`type Combined = A & B;`);

      expect(alias.name).toBe('Combined');
      expect(alias.aliasedType).toBe('A & B');
    });

    it('should extract complex union type', () => {
      const alias = parseTypeAlias(`type Status = 'pending' | 'active' | 'done';`);

      expect(alias.name).toBe('Status');
      expect(alias.aliasedType).toContain('pending');
    });
  });

  describe('generic type aliases', () => {
    it('should extract type alias with single type parameter', () => {
      const alias = parseTypeAlias(`type Result<T> = T | Error;`);

      expect(alias.name).toBe('Result');
      expect(alias.typeParameters).toHaveLength(1);
      expect(alias.typeParameters![0]!.name).toBe('T');
    });

    it('should extract type alias with multiple type parameters', () => {
      const alias = parseTypeAlias(`type Pair<K, V> = { key: K; value: V };`);

      expect(alias.name).toBe('Pair');
      expect(alias.typeParameters).toHaveLength(2);
      expect(alias.typeParameters![0]!.name).toBe('K');
      expect(alias.typeParameters![1]!.name).toBe('V');
    });

    it('should extract type parameter with constraint', () => {
      const alias = parseTypeAlias(`type Handler<T extends object> = (input: T) => void;`);

      expect(alias.name).toBe('Handler');
      expect(alias.typeParameters).toHaveLength(1);
      expect(alias.typeParameters![0]!.name).toBe('T');
      expect(alias.typeParameters![0]!.bounds).toContain('object');
    });

    it('should handle type alias without generics', () => {
      const alias = parseTypeAlias(`type Simple = string;`);

      expect(alias.typeParameters).toBeUndefined();
    });
  });

  describe('function type aliases', () => {
    it('should extract function type alias', () => {
      const alias = parseTypeAlias(`type Callback = () => void;`);

      expect(alias.name).toBe('Callback');
      expect(alias.aliasedType).toBe('() => void');
    });

    it('should extract function type with parameters', () => {
      const alias = parseTypeAlias(`type Handler = (event: Event) => boolean;`);

      expect(alias.name).toBe('Handler');
      expect(alias.aliasedType).toContain('event');
    });
  });

  describe('array and tuple types', () => {
    it('should extract array type alias', () => {
      const alias = parseTypeAlias(`type StringArray = string[];`);

      expect(alias.name).toBe('StringArray');
      expect(alias.aliasedType).toBe('string[]');
    });

    it('should extract tuple type alias', () => {
      const alias = parseTypeAlias(`type Point = [number, number];`);

      expect(alias.name).toBe('Point');
      expect(alias.aliasedType).toBe('[number, number]');
    });
  });

  describe('location tracking', () => {
    it('should track source location', () => {
      const alias = parseTypeAlias(`type UserId = string;`);

      expect(alias.location).toBeDefined();
      // Note: filePath is set to '' by nodeLocation, will be set by caller
      expect(alias.location.startLine).toBe(1);
      expect(alias.location.startColumn).toBeGreaterThan(0);
    });
  });
});
