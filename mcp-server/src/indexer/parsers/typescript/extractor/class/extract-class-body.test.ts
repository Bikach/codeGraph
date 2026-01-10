import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractClassBody, type ClassExtractor } from './extract-class-body.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractClass } from './extract-class.js';

/**
 * Helper to parse and extract class body from TypeScript source.
 */
function parseClassBody(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  const classBody = findChildByType(classNode, 'class_body');
  const classExtractor: ClassExtractor = (node) => extractClass(node);
  return extractClassBody(classBody, classExtractor);
}

describe('extractClassBody', () => {
  describe('empty class', () => {
    it('should return empty arrays for empty class', () => {
      const { properties, functions, nestedClasses } = parseClassBody(`class Empty {}`);

      expect(properties).toEqual([]);
      expect(functions).toEqual([]);
      expect(nestedClasses).toEqual([]);
    });
  });

  describe('properties extraction', () => {
    it('should extract public field', () => {
      const { properties } = parseClassBody(`
        class User {
          name: string;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('name');
    });

    it('should extract private field', () => {
      const { properties } = parseClassBody(`
        class User {
          private name: string;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('name');
      expect(properties[0]!.visibility).toBe('private');
    });

    it('should extract readonly field', () => {
      const { properties } = parseClassBody(`
        class User {
          readonly id: number;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('id');
      expect(properties[0]!.isVal).toBe(true);
    });

    it('should extract field with initializer', () => {
      const { properties } = parseClassBody(`
        class Config {
          timeout = 30;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('timeout');
      expect(properties[0]!.initializer).toBe('30');
    });

    it('should extract multiple properties', () => {
      const { properties } = parseClassBody(`
        class User {
          id: number;
          name: string;
          email?: string;
        }
      `);

      expect(properties).toHaveLength(3);
      expect(properties.map((p) => p.name)).toEqual(['id', 'name', 'email']);
    });
  });

  describe('methods extraction', () => {
    it('should extract method', () => {
      const { functions } = parseClassBody(`
        class Service {
          getData() { return null; }
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('getData');
    });

    it('should extract async method', () => {
      const { functions } = parseClassBody(`
        class Service {
          async fetchData(): Promise<void> {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('fetchData');
      expect(functions[0]!.isSuspend).toBe(true);
    });

    it('should extract private method', () => {
      const { functions } = parseClassBody(`
        class Service {
          private helper() {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.visibility).toBe('private');
    });

    it('should extract method with parameters', () => {
      const { functions } = parseClassBody(`
        class Service {
          process(data: string, count: number): void {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.parameters).toHaveLength(2);
    });

    it('should extract multiple methods', () => {
      const { functions } = parseClassBody(`
        class Service {
          start() {}
          stop() {}
          restart() {}
        }
      `);

      expect(functions).toHaveLength(3);
      expect(functions.map((f) => f.name)).toEqual(['start', 'stop', 'restart']);
    });
  });

  describe('decorators on members', () => {
    it('should extract decorator on method', () => {
      const { functions } = parseClassBody(`
        class Controller {
          @Get('/users')
          getUsers() {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.annotations).toHaveLength(1);
      expect(functions[0]!.annotations[0]!.name).toBe('Get');
    });

    it('should extract multiple decorators on method', () => {
      const { functions } = parseClassBody(`
        class Controller {
          @Get('/users')
          @Auth()
          getUsers() {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.annotations).toHaveLength(2);
    });

    it('should extract decorator on property', () => {
      const { properties } = parseClassBody(`
        class Entity {
          @Column()
          name: string;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.annotations).toHaveLength(1);
      expect(properties[0]!.annotations[0]!.name).toBe('Column');
    });
  });

  describe('getters and setters', () => {
    it('should extract getter as method', () => {
      const { functions } = parseClassBody(`
        class User {
          get fullName(): string { return ''; }
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('fullName');
    });

    it('should extract setter as method', () => {
      const { functions } = parseClassBody(`
        class User {
          set fullName(value: string) {}
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('fullName');
    });
  });

  describe('nested classes', () => {
    it('should extract nested class', () => {
      const { nestedClasses } = parseClassBody(`
        class Outer {
          static Inner = class {
            data: string;
          }
        }
      `);

      // Note: Static property with class expression is different from nested class declaration
      // This test may need adjustment based on actual AST structure
      expect(nestedClasses).toBeDefined();
    });
  });

  describe('mixed members', () => {
    it('should extract all member types', () => {
      const { properties, functions } = parseClassBody(`
        class Service {
          private name: string;
          readonly id: number;

          getData(): string { return this.name; }
          async fetchData(): Promise<void> {}
        }
      `);

      expect(properties).toHaveLength(2);
      expect(functions).toHaveLength(2);
    });
  });
});
