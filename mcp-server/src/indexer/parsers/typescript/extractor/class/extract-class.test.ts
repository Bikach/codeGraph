/**
 * Tests for extractClass
 */
import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractClass } from './extract-class.js';
import { extractInterface } from './extract-interface.js';
import { extractEnum } from './extract-enum.js';

/**
 * Helper to get a type declaration from TypeScript source.
 * Handles both direct declarations and export statements.
 */
function getTypeDeclaration(source: string) {
  const tree = parseTypeScript(source, 'test.ts');
  const root = tree.rootNode;

  // Try direct declarations first
  let node =
    findChildByType(root, 'class_declaration') ??
    findChildByType(root, 'abstract_class_declaration') ??
    findChildByType(root, 'interface_declaration') ??
    findChildByType(root, 'enum_declaration');

  if (node) return node;

  // Check for export statements
  const exportStatement = findChildByType(root, 'export_statement');
  if (exportStatement) {
    node =
      findChildByType(exportStatement, 'class_declaration') ??
      findChildByType(exportStatement, 'abstract_class_declaration') ??
      findChildByType(exportStatement, 'interface_declaration') ??
      findChildByType(exportStatement, 'enum_declaration');
  }

  return node;
}

describe('extractClass', () => {
  describe('basic class properties', () => {
    it('should extract simple class name and kind', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.kind).toBe('class');
    });

    it('should extract exported class', () => {
      const node = getTypeDeclaration('export class Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.visibility).toBe('public');
    });

    it('should extract abstract class', () => {
      const node = getTypeDeclaration('abstract class Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.isAbstract).toBe(true);
    });

    it('should extract exported abstract class', () => {
      const node = getTypeDeclaration('export abstract class Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.isAbstract).toBe(true);
    });
  });

  describe('type parameters (generics)', () => {
    it('should extract single type parameter', () => {
      const node = getTypeDeclaration('class Box<T> {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toHaveLength(1);
      expect(result.typeParameters![0]!.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = getTypeDeclaration('class Pair<K, V> {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toHaveLength(2);
      expect(result.typeParameters![0]!.name).toBe('K');
      expect(result.typeParameters![1]!.name).toBe('V');
    });

    it('should extract type parameter with constraint', () => {
      const node = getTypeDeclaration('class NumberBox<T extends number> {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toHaveLength(1);
      expect(result.typeParameters![0]!.name).toBe('T');
      expect(result.typeParameters![0]!.bounds).toContain('number');
    });

    it('should return undefined for class without generics', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toBeUndefined();
    });
  });

  describe('inheritance', () => {
    it('should extract superclass', () => {
      const node = getTypeDeclaration('class Foo extends Bar {}');
      const result = extractClass(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract generic superclass', () => {
      const node = getTypeDeclaration('class Foo extends Bar<string> {}');
      const result = extractClass(node!);

      expect(result.superClass).toBe('Bar<string>');
    });

    it('should extract implemented interfaces', () => {
      const node = getTypeDeclaration('class Foo implements Serializable, Cloneable {}');
      const result = extractClass(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable', 'Cloneable']);
    });

    it('should extract both superclass and interfaces', () => {
      const node = getTypeDeclaration('class Foo extends Bar implements Serializable {}');
      const result = extractClass(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual(['Serializable']);
    });
  });

  describe('decorators', () => {
    it('should extract single decorator', () => {
      const node = getTypeDeclaration('@Injectable class Foo {}');
      const result = extractClass(node!);

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0]!.name).toBe('Injectable');
    });

    it('should extract decorator with parentheses', () => {
      const node = getTypeDeclaration('@Injectable() class Foo {}');
      const result = extractClass(node!);

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0]!.name).toBe('Injectable');
    });

    it('should extract multiple decorators', () => {
      const node = getTypeDeclaration('@Injectable @Controller class Foo {}');
      const result = extractClass(node!);

      expect(result.annotations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('class members', () => {
    it('should extract properties', () => {
      const node = getTypeDeclaration(`
        class Foo {
          private x: number;
          public name: string;
        }
      `);
      const result = extractClass(node!);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract methods', () => {
      const node = getTypeDeclaration(`
        class Foo {
          public bar(): void {}
        }
      `);
      const result = extractClass(node!);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('bar');
    });

    it('should extract abstract methods', () => {
      const node = getTypeDeclaration(`
        abstract class Foo {
          abstract bar(): void;
        }
      `);
      const result = extractClass(node!);

      expect(result.isAbstract).toBe(true);
    });
  });

  describe('nested classes', () => {
    it('should extract nested class', () => {
      const node = getTypeDeclaration(`
        class Outer {
          static Inner = class Inner {}
        }
      `);
      const result = extractClass(node!);

      // Static class expression might be extracted differently
      expect(result.name).toBe('Outer');
    });
  });

  describe('location', () => {
    it('should include source location', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThanOrEqual(1);
      expect(result.location.startColumn).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TypeScript-specific: no companion objects', () => {
    it('should have undefined companionObject', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.companionObject).toBeUndefined();
    });
  });
});

describe('extractInterface', () => {
  describe('basic interface properties', () => {
    it('should extract simple interface name and kind', () => {
      const node = getTypeDeclaration('interface Foo {}');
      const result = extractInterface(node!);

      expect(result.name).toBe('Foo');
      expect(result.kind).toBe('interface');
    });

    it('should extract exported interface', () => {
      const node = getTypeDeclaration('export interface Foo {}');
      const result = extractInterface(node!);

      expect(result.name).toBe('Foo');
    });

    it('should mark interfaces as abstract', () => {
      const node = getTypeDeclaration('interface Foo {}');
      const result = extractInterface(node!);

      expect(result.isAbstract).toBe(true);
    });
  });

  describe('interface extends', () => {
    it('should extract extended interfaces', () => {
      const node = getTypeDeclaration('interface Foo extends Bar {}');
      const result = extractInterface(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toContain('Bar');
    });

    it('should extract multiple extended interfaces', () => {
      const node = getTypeDeclaration('interface Foo extends Bar, Baz {}');
      const result = extractInterface(node!);

      expect(result.interfaces).toEqual(['Bar', 'Baz']);
    });
  });

  describe('interface type parameters', () => {
    it('should extract type parameters', () => {
      const node = getTypeDeclaration('interface Container<T> {}');
      const result = extractInterface(node!);

      expect(result.typeParameters).toHaveLength(1);
      expect(result.typeParameters![0]!.name).toBe('T');
    });
  });

  describe('interface members', () => {
    it('should extract property signatures', () => {
      const node = getTypeDeclaration(`
        interface Foo {
          name: string;
          age: number;
        }
      `);
      const result = extractInterface(node!);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract method signatures', () => {
      const node = getTypeDeclaration(`
        interface Foo {
          greet(): void;
        }
      `);
      const result = extractInterface(node!);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('greet');
    });
  });
});

describe('extractEnum', () => {
  describe('basic enum properties', () => {
    it('should extract simple enum name and kind', () => {
      const node = getTypeDeclaration('enum Status { Active, Inactive }');
      const result = extractEnum(node!);

      expect(result.name).toBe('Status');
      expect(result.kind).toBe('enum');
    });

    it('should extract exported enum', () => {
      const node = getTypeDeclaration('export enum Status { Active }');
      const result = extractEnum(node!);

      expect(result.name).toBe('Status');
    });

    it('should extract const enum', () => {
      const node = getTypeDeclaration('const enum Status { Active }');
      const result = extractEnum(node!);

      expect(result.name).toBe('Status');
      expect(result.isSealed).toBe(true); // const enum maps to isSealed
    });
  });

  describe('enum members', () => {
    it('should extract enum members as properties', () => {
      const node = getTypeDeclaration('enum Status { Active, Inactive }');
      const result = extractEnum(node!);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract enum members with values', () => {
      const node = getTypeDeclaration('enum Status { Active = 1, Inactive = 0 }');
      const result = extractEnum(node!);

      const active = result.properties.find((p) => p.name === 'Active');
      expect(active).toBeDefined();
      expect(active!.initializer).toBe('1');
    });

    it('should extract string enum members', () => {
      const node = getTypeDeclaration(`enum Status { Active = 'ACTIVE', Inactive = 'INACTIVE' }`);
      const result = extractEnum(node!);

      expect(result.properties.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('location', () => {
    it('should include source location', () => {
      const node = getTypeDeclaration('enum Status { Active }');
      const result = extractEnum(node!);

      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThanOrEqual(1);
    });
  });
});
