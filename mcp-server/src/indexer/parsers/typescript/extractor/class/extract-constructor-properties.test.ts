import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractConstructorProperties } from './extract-constructor-properties.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract constructor properties from TypeScript source.
 */
function parseConstructorProperties(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  const classBody = findChildByType(classNode, 'class_body');
  return extractConstructorProperties(classBody);
}

describe('extractConstructorProperties', () => {
  describe('public parameter property', () => {
    it('should extract public parameter property', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(public name: string) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'name',
        type: 'string',
        visibility: 'public',
        isVal: false,
      });
    });

    it('should extract multiple public parameter properties', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(public name: string, public email: string) {}
        }
      `);

      expect(properties).toHaveLength(2);
      expect(properties[0]!.name).toBe('name');
      expect(properties[1]!.name).toBe('email');
    });
  });

  describe('private parameter property', () => {
    it('should extract private parameter property', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(private age: number) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'age',
        type: 'number',
        visibility: 'private',
        isVal: false,
      });
    });
  });

  describe('protected parameter property', () => {
    it('should extract protected parameter property', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(protected email: string) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'email',
        type: 'string',
        visibility: 'protected',
        isVal: false,
      });
    });
  });

  describe('readonly parameter property', () => {
    it('should extract readonly parameter property with public visibility', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(readonly id: string) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'id',
        type: 'string',
        visibility: 'public',
        isVal: true,
      });
    });

    it('should extract private readonly parameter property', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(private readonly secret: string) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'secret',
        type: 'string',
        visibility: 'private',
        isVal: true,
      });
    });

    it('should extract public readonly parameter property', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(public readonly id: string) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'id',
        type: 'string',
        visibility: 'public',
        isVal: true,
      });
    });
  });

  describe('mixed regular and parameter properties', () => {
    it('should only extract parameter properties, not regular parameters', () => {
      const properties = parseConstructorProperties(`
        class User {
          constructor(
            public name: string,
            private age: number,
            readonly id: string,
            normalParam: string
          ) {}
        }
      `);

      expect(properties).toHaveLength(3);
      expect(properties.map((p) => p.name)).toEqual(['name', 'age', 'id']);
    });
  });

  describe('parameter property with default value', () => {
    it('should extract parameter property with default value', () => {
      const properties = parseConstructorProperties(`
        class Config {
          constructor(public timeout: number = 30) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'timeout',
        type: 'number',
        visibility: 'public',
        initializer: '30',
      });
    });
  });

  describe('parameter property with complex type', () => {
    it('should extract parameter property with generic type', () => {
      const properties = parseConstructorProperties(`
        class Container {
          constructor(public items: Array<string>) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        name: 'items',
        type: 'Array<string>',
        visibility: 'public',
      });
    });

    it('should extract parameter property with union type', () => {
      const properties = parseConstructorProperties(`
        class Result {
          constructor(public value: string | null) {}
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('value');
      expect(properties[0]!.type).toContain('string');
    });
  });

  describe('class without constructor', () => {
    it('should return empty array for class without constructor', () => {
      const properties = parseConstructorProperties(`
        class Empty {
          name: string;
        }
      `);

      expect(properties).toHaveLength(0);
    });
  });

  describe('constructor without parameter properties', () => {
    it('should return empty array for constructor with only regular params', () => {
      const properties = parseConstructorProperties(`
        class User {
          name: string;
          constructor(name: string) {
            this.name = name;
          }
        }
      `);

      expect(properties).toHaveLength(0);
    });
  });

  describe('integration with extractClassBody', () => {
    it('should include constructor properties in class body extraction', async () => {
      const { extractClassBody } = await import('./extract-class-body.js');
      const { extractClass } = await import('./extract-class.js');

      const source = `
        class User {
          regularProp: string;
          constructor(public name: string, private age: number) {}
        }
      `;

      const tree = parseTypeScript(source, '/test.ts');
      const classNode = findChildByType(tree.rootNode, 'class_declaration');
      const classBody = findChildByType(classNode!, 'class_body');
      const result = extractClassBody(classBody, extractClass);

      // Should have constructor properties + regular property
      expect(result.properties).toHaveLength(3);
      expect(result.properties.map((p) => p.name)).toEqual(['name', 'age', 'regularProp']);
    });
  });
});
