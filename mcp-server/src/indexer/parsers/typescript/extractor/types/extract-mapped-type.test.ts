import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractMappedType, isMappedType } from './extract-mapped-type.js';
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

/**
 * Helper to get the aliased type node from a type alias.
 */
function getAliasedTypeNode(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const typeAliasNode = findChildByType(tree.rootNode, 'type_alias_declaration');
  if (!typeAliasNode) throw new Error('No type alias found');

  let foundEquals = false;
  for (const child of typeAliasNode.children) {
    if (foundEquals) {
      return child;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }
  return undefined;
}

describe('isMappedType', () => {
  it('should return true for basic mapped type', () => {
    const typeNode = getAliasedTypeNode(`type MyType = { [K in keyof T]: T[K] };`);
    expect(typeNode).toBeDefined();
    expect(isMappedType(typeNode!)).toBe(true);
  });

  it('should return false for regular object type', () => {
    const typeNode = getAliasedTypeNode(`type MyType = { name: string };`);
    expect(typeNode).toBeDefined();
    expect(isMappedType(typeNode!)).toBe(false);
  });

  it('should return false for primitive type', () => {
    const typeNode = getAliasedTypeNode(`type MyType = string;`);
    expect(typeNode).toBeDefined();
    expect(isMappedType(typeNode!)).toBe(false);
  });

  it('should return true for readonly mapped type', () => {
    const typeNode = getAliasedTypeNode(`type MyType = { readonly [K in keyof T]: T[K] };`);
    expect(typeNode).toBeDefined();
    expect(isMappedType(typeNode!)).toBe(true);
  });
});

describe('extractMappedType', () => {
  describe('basic mapped types', () => {
    it('should extract basic mapped type with keyof', () => {
      const alias = parseTypeAlias(`type Readonly<T> = { [K in keyof T]: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.keyName).toBe('K');
      expect(alias.mappedType!.constraint).toBe('T');
      expect(alias.mappedType!.hasKeyof).toBe(true);
      expect(alias.mappedType!.valueType).toBe('T[K]');
      expect(alias.mappedType!.modifiers).toHaveLength(0);
    });

    it('should extract mapped type without keyof (Record-style)', () => {
      const alias = parseTypeAlias(`type Record<K, V> = { [P in K]: V };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.keyName).toBe('P');
      expect(alias.mappedType!.constraint).toBe('K');
      expect(alias.mappedType!.hasKeyof).toBe(false);
      expect(alias.mappedType!.valueType).toBe('V');
    });

    it('should preserve aliasedType as raw text', () => {
      const alias = parseTypeAlias(`type Readonly<T> = { [K in keyof T]: T[K] };`);

      expect(alias.aliasedType).toBe('{ [K in keyof T]: T[K] }');
    });
  });

  describe('readonly modifier', () => {
    it('should extract readonly modifier', () => {
      const alias = parseTypeAlias(`type Readonly<T> = { readonly [K in keyof T]: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(1);
      expect(alias.mappedType!.modifiers[0]).toEqual({
        kind: 'readonly',
        prefix: undefined,
      });
    });

    it('should extract -readonly modifier (remove readonly)', () => {
      const alias = parseTypeAlias(`type Mutable<T> = { -readonly [K in keyof T]: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(1);
      expect(alias.mappedType!.modifiers[0]).toEqual({
        kind: 'readonly',
        prefix: '-',
      });
    });

    it('should extract +readonly modifier (add readonly)', () => {
      const alias = parseTypeAlias(`type ReadonlyExplicit<T> = { +readonly [K in keyof T]: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(1);
      expect(alias.mappedType!.modifiers[0]).toEqual({
        kind: 'readonly',
        prefix: '+',
      });
    });
  });

  describe('optional modifier', () => {
    it('should extract optional modifier (?)', () => {
      const alias = parseTypeAlias(`type Partial<T> = { [K in keyof T]?: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(1);
      expect(alias.mappedType!.modifiers[0]).toEqual({
        kind: 'optional',
        prefix: undefined,
      });
    });

    it('should extract -? modifier (remove optional)', () => {
      const alias = parseTypeAlias(`type Required<T> = { [K in keyof T]-?: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(1);
      expect(alias.mappedType!.modifiers[0]).toEqual({
        kind: 'optional',
        prefix: '-',
      });
    });
  });

  describe('combined modifiers', () => {
    it('should extract readonly and optional modifiers', () => {
      const alias = parseTypeAlias(`type ReadonlyPartial<T> = { readonly [K in keyof T]?: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(2);

      const readonlyMod = alias.mappedType!.modifiers.find((m) => m.kind === 'readonly');
      const optionalMod = alias.mappedType!.modifiers.find((m) => m.kind === 'optional');

      expect(readonlyMod).toEqual({ kind: 'readonly', prefix: undefined });
      expect(optionalMod).toEqual({ kind: 'optional', prefix: undefined });
    });

    it('should extract -readonly and -? modifiers', () => {
      const alias = parseTypeAlias(`type MutableRequired<T> = { -readonly [K in keyof T]-?: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.modifiers).toHaveLength(2);

      const readonlyMod = alias.mappedType!.modifiers.find((m) => m.kind === 'readonly');
      const optionalMod = alias.mappedType!.modifiers.find((m) => m.kind === 'optional');

      expect(readonlyMod).toEqual({ kind: 'readonly', prefix: '-' });
      expect(optionalMod).toEqual({ kind: 'optional', prefix: '-' });
    });
  });

  describe('as clause (key remapping)', () => {
    it('should extract as clause with generic type', () => {
      const alias = parseTypeAlias(
        `type MappedWithAs<T> = { [K in keyof T as Uppercase<K & string>]: T[K] };`
      );

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.asClause).toBe('Uppercase<K & string>');
    });

    it('should extract as clause with template literal type', () => {
      const alias = parseTypeAlias(
        'type Getters<T> = { [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K] };'
      );

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.asClause).toBe('`get${Capitalize<K & string>}`');
      expect(alias.mappedType!.valueType).toBe('() => T[K]');
    });

    it('should not have as clause for simple mapped type', () => {
      const alias = parseTypeAlias(`type Simple<T> = { [K in keyof T]: T[K] };`);

      expect(alias.mappedType).toBeDefined();
      expect(alias.mappedType!.asClause).toBeUndefined();
    });
  });

  describe('non-mapped types', () => {
    it('should not have mappedType for primitive type alias', () => {
      const alias = parseTypeAlias(`type UserId = string;`);

      expect(alias.mappedType).toBeUndefined();
    });

    it('should not have mappedType for regular object type', () => {
      const alias = parseTypeAlias(`type User = { name: string; age: number };`);

      expect(alias.mappedType).toBeUndefined();
    });

    it('should not have mappedType for union type', () => {
      const alias = parseTypeAlias(`type StringOrNumber = string | number;`);

      expect(alias.mappedType).toBeUndefined();
    });

    it('should not have mappedType for index signature without mapped_type_clause', () => {
      const alias = parseTypeAlias(`type Dict = { [key: string]: number };`);

      expect(alias.mappedType).toBeUndefined();
    });
  });

  describe('value type extraction', () => {
    it('should extract lookup type as value type', () => {
      const alias = parseTypeAlias(`type Mapped<T> = { [K in keyof T]: T[K] };`);

      expect(alias.mappedType!.valueType).toBe('T[K]');
    });

    it('should extract function type as value type', () => {
      const alias = parseTypeAlias(`type Getters<T> = { [K in keyof T]: () => T[K] };`);

      expect(alias.mappedType!.valueType).toBe('() => T[K]');
    });

    it('should extract simple type identifier as value type', () => {
      const alias = parseTypeAlias(`type AllStrings<T> = { [K in keyof T]: string };`);

      expect(alias.mappedType!.valueType).toBe('string');
    });

    it('should extract generic type as value type', () => {
      const alias = parseTypeAlias(`type Wrapped<T> = { [K in keyof T]: Promise<T[K]> };`);

      expect(alias.mappedType!.valueType).toBe('Promise<T[K]>');
    });
  });
});
