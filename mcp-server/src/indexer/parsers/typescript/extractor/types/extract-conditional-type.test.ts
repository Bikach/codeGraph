import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import {
  extractConditionalType,
  isConditionalType,
  findConditionalTypeNode,
} from './extract-conditional-type.js';
import { extractTypeAlias } from './extract-type-alias.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract a conditional type from a type alias.
 */
function parseConditionalTypeAlias(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const typeAliasNode = findChildByType(tree.rootNode, 'type_alias_declaration');
  if (!typeAliasNode) throw new Error('No type alias found');
  return extractTypeAlias(typeAliasNode);
}

/**
 * Helper to find and extract a conditional type node directly.
 */
function parseConditionalType(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const conditionalNode = findConditionalTypeNode(tree.rootNode);
  if (!conditionalNode) throw new Error('No conditional type found');
  return extractConditionalType(conditionalNode);
}

describe('extractConditionalType', () => {
  describe('basic conditional types', () => {
    it('should extract simple conditional type with literal types', () => {
      const alias = parseConditionalTypeAlias(
        `type IsArray<T> = T extends any[] ? true : false;`,
      );

      expect(alias.name).toBe('IsArray');
      expect(alias.aliasedType).toBe('T extends any[] ? true : false');
      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('any[]');
      expect(alias.conditionalType!.trueType).toBe('true');
      expect(alias.conditionalType!.falseType).toBe('false');
    });

    it('should extract conditional type with type identifiers', () => {
      const alias = parseConditionalTypeAlias(
        `type NonNullable<T> = T extends null | undefined ? never : T;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('null | undefined');
      expect(alias.conditionalType!.trueType).toBe('never');
      expect(alias.conditionalType!.falseType).toBe('T');
    });

    it('should extract conditional type with predefined types', () => {
      const alias = parseConditionalTypeAlias(
        `type IsString<T> = T extends string ? true : false;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.extendsType).toBe('string');
    });

    it('should extract conditional type with object type', () => {
      const alias = parseConditionalTypeAlias(
        `type IsObject<T> = T extends object ? T : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.extendsType).toBe('object');
      expect(alias.conditionalType!.trueType).toBe('T');
      expect(alias.conditionalType!.falseType).toBe('never');
    });
  });

  describe('conditional types with infer', () => {
    it('should extract infer type from Promise', () => {
      const alias = parseConditionalTypeAlias(
        `type Unwrap<T> = T extends Promise<infer U> ? U : T;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('Promise<infer U>');
      expect(alias.conditionalType!.trueType).toBe('U');
      expect(alias.conditionalType!.falseType).toBe('T');
      expect(alias.conditionalType!.inferTypes).toEqual(['U']);
    });

    it('should extract multiple infer types', () => {
      const alias = parseConditionalTypeAlias(
        `type GetArgs<T> = T extends (...args: infer A) => infer R ? [A, R] : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.inferTypes).toContain('A');
      // Note: Only infer types in the extends clause are captured
      // R is in the return type of the function type in extends
      expect(alias.conditionalType!.inferTypes).toContain('R');
    });

    it('should extract infer from array type', () => {
      const alias = parseConditionalTypeAlias(
        `type ArrayElement<T> = T extends (infer E)[] ? E : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.inferTypes).toEqual(['E']);
      expect(alias.conditionalType!.trueType).toBe('E');
    });

    it('should extract infer from tuple type', () => {
      const alias = parseConditionalTypeAlias(
        `type First<T> = T extends [infer F, ...unknown[]] ? F : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.inferTypes).toEqual(['F']);
    });
  });

  describe('nested conditional types', () => {
    it('should extract nested conditional in false branch', () => {
      const alias = parseConditionalTypeAlias(
        `type Deep<T> = T extends any[] ? T[0] : T extends object ? keyof T : T;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('any[]');
      expect(alias.conditionalType!.nestedFalseConditional).toBeDefined();

      const nested = alias.conditionalType!.nestedFalseConditional!;
      expect(nested.checkType).toBe('T');
      expect(nested.extendsType).toBe('object');
      expect(nested.trueType).toBe('keyof T');
      expect(nested.falseType).toBe('T');
    });

    it('should extract nested conditional in true branch', () => {
      const alias = parseConditionalTypeAlias(
        `type Nested<T> = T extends object ? T extends Function ? 'function' : 'object' : 'primitive';`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('object');
      expect(alias.conditionalType!.nestedTrueConditional).toBeDefined();

      const nested = alias.conditionalType!.nestedTrueConditional!;
      expect(nested.checkType).toBe('T');
      expect(nested.extendsType).toBe('Function');
      expect(nested.trueType).toBe("'function'");
      expect(nested.falseType).toBe("'object'");
    });

    it('should handle deeply nested conditionals', () => {
      const alias = parseConditionalTypeAlias(
        `type TypeName<T> = T extends string ? 'string' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'object';`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.nestedFalseConditional).toBeDefined();
      expect(
        alias.conditionalType!.nestedFalseConditional!.nestedFalseConditional,
      ).toBeDefined();
    });
  });

  describe('distributed conditional types', () => {
    it('should extract distributed conditional type', () => {
      // Distributed conditional types apply the condition to each member of a union
      const alias = parseConditionalTypeAlias(
        `type ToArray<T> = T extends any ? T[] : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('T');
      expect(alias.conditionalType!.extendsType).toBe('any');
      expect(alias.conditionalType!.trueType).toBe('T[]');
    });

    it('should extract non-distributed conditional using array wrapper', () => {
      // [T] prevents distribution over union types
      const alias = parseConditionalTypeAlias(
        `type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('[T]');
      expect(alias.conditionalType!.extendsType).toBe('[any]');
    });
  });

  describe('complex conditional types', () => {
    it('should extract conditional with generic type in extends', () => {
      const alias = parseConditionalTypeAlias(
        `type IsPromise<T> = T extends Promise<unknown> ? true : false;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.extendsType).toBe('Promise<unknown>');
    });

    it('should extract conditional with function type', () => {
      const alias = parseConditionalTypeAlias(
        `type IsFunction<T> = T extends (...args: any[]) => any ? true : false;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.extendsType).toBe('(...args: any[]) => any');
    });

    it('should extract conditional with keyof', () => {
      const alias = parseConditionalTypeAlias(
        `type HasKey<T, K> = K extends keyof T ? true : false;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.checkType).toBe('K');
      expect(alias.conditionalType!.extendsType).toBe('keyof T');
    });

    it('should extract conditional with mapped type result', () => {
      const alias = parseConditionalTypeAlias(
        `type Flatten<T> = T extends any[] ? T[number] : T;`,
      );

      expect(alias.conditionalType).toBeDefined();
      expect(alias.conditionalType!.trueType).toBe('T[number]');
    });
  });

  describe('type alias without conditional', () => {
    it('should not have conditionalType for simple type alias', () => {
      const alias = parseConditionalTypeAlias(`type UserId = string;`);

      expect(alias.conditionalType).toBeUndefined();
    });

    it('should not have conditionalType for union type', () => {
      const alias = parseConditionalTypeAlias(
        `type StringOrNumber = string | number;`,
      );

      expect(alias.conditionalType).toBeUndefined();
    });

    it('should not have conditionalType for generic type', () => {
      const alias = parseConditionalTypeAlias(
        `type Result<T> = T | Error;`,
      );

      expect(alias.conditionalType).toBeUndefined();
    });
  });

  describe('helper functions', () => {
    it('isConditionalType should return true for conditional_type node', () => {
      const tree = parseTypeScript(
        `type X = T extends U ? Y : Z;`,
        '/test.ts',
      );
      const conditionalNode = findConditionalTypeNode(tree.rootNode);

      expect(conditionalNode).toBeDefined();
      expect(isConditionalType(conditionalNode!)).toBe(true);
    });

    it('isConditionalType should return false for other node types', () => {
      const tree = parseTypeScript(`type X = string;`, '/test.ts');
      const typeAliasNode = findChildByType(
        tree.rootNode,
        'type_alias_declaration',
      );

      expect(isConditionalType(typeAliasNode!)).toBe(false);
    });

    it('findConditionalTypeNode should find nested conditional', () => {
      const tree = parseTypeScript(
        `type X = T extends U ? Y : Z;`,
        '/test.ts',
      );
      const conditionalNode = findConditionalTypeNode(tree.rootNode);

      expect(conditionalNode).toBeDefined();
      expect(conditionalNode!.type).toBe('conditional_type');
    });

    it('findConditionalTypeNode should return undefined when no conditional', () => {
      const tree = parseTypeScript(`type X = string;`, '/test.ts');
      const conditionalNode = findConditionalTypeNode(tree.rootNode);

      expect(conditionalNode).toBeUndefined();
    });
  });
});
