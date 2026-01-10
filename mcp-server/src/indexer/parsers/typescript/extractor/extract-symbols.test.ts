import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../parser.js';
import { extractSymbols } from './extract-symbols.js';

describe('extractSymbols', () => {
  describe('basic structure', () => {
    it('should return ParsedFile with correct filePath and language', () => {
      const source = `const x = 1;`;
      const tree = parseTypeScript(source, '/test/Example.ts');
      const result = extractSymbols(tree, '/test/Example.ts');

      expect(result.filePath).toBe('/test/Example.ts');
      expect(result.language).toBe('typescript');
    });

    it('should initialize all arrays as empty when no declarations', () => {
      const source = `// empty file`;
      const tree = parseTypeScript(source, '/test/Empty.ts');
      const result = extractSymbols(tree, '/test/Empty.ts');

      expect(result.classes).toEqual([]);
      expect(result.topLevelFunctions).toEqual([]);
      expect(result.topLevelProperties).toEqual([]);
      expect(result.typeAliases).toEqual([]);
      expect(result.destructuringDeclarations).toEqual([]);
      expect(result.objectExpressions).toEqual([]);
    });

    it('should handle empty file', () => {
      const source = ``;
      const tree = parseTypeScript(source, '/test/Empty.ts');
      const result = extractSymbols(tree, '/test/Empty.ts');

      expect(result.packageName).toBeUndefined();
      expect(result.imports).toEqual([]);
      expect(result.classes).toEqual([]);
    });
  });

  describe('imports extraction', () => {
    it('should extract named imports', () => {
      const source = `import { useState, useEffect } from 'react';`;
      const tree = parseTypeScript(source, '/test/Component.ts');
      const result = extractSymbols(tree, '/test/Component.ts');

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]!.name).toBe('useState');
      expect(result.imports[1]!.name).toBe('useEffect');
    });

    it('should extract default imports', () => {
      const source = `import React from 'react';`;
      const tree = parseTypeScript(source, '/test/Component.ts');
      const result = extractSymbols(tree, '/test/Component.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]!.name).toBe('React');
    });

    it('should extract namespace imports', () => {
      const source = `import * as path from 'path';`;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]!.isWildcard).toBe(true);
      expect(result.imports[0]!.alias).toBe('path');
    });
  });

  describe('class declarations dispatch', () => {
    it('should dispatch class_declaration to classes array', () => {
      const source = `class UserService {}`;
      const tree = parseTypeScript(source, '/test/UserService.ts');
      const result = extractSymbols(tree, '/test/UserService.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('UserService');
      expect(result.classes[0]!.kind).toBe('class');
    });

    it('should dispatch abstract class to classes array', () => {
      const source = `abstract class BaseService {}`;
      const tree = parseTypeScript(source, '/test/BaseService.ts');
      const result = extractSymbols(tree, '/test/BaseService.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('BaseService');
      expect(result.classes[0]!.isAbstract).toBe(true);
    });

    it('should dispatch interface_declaration to classes array', () => {
      const source = `interface Repository { find(id: string): void; }`;
      const tree = parseTypeScript(source, '/test/Repository.ts');
      const result = extractSymbols(tree, '/test/Repository.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Repository');
      expect(result.classes[0]!.kind).toBe('interface');
    });

    it('should dispatch enum_declaration to classes array', () => {
      const source = `enum Status { PENDING, ACTIVE }`;
      const tree = parseTypeScript(source, '/test/Status.ts');
      const result = extractSymbols(tree, '/test/Status.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Status');
      expect(result.classes[0]!.kind).toBe('enum');
    });

    it('should handle multiple class-like declarations', () => {
      const source = `
        class Service {}
        interface Repository {}
        enum Status {}
      `;
      const tree = parseTypeScript(source, '/test/Multi.ts');
      const result = extractSymbols(tree, '/test/Multi.ts');

      expect(result.classes).toHaveLength(3);
      expect(result.classes.map((c) => c.name)).toEqual(['Service', 'Repository', 'Status']);
    });
  });

  describe('function declarations dispatch', () => {
    it('should dispatch function_declaration to topLevelFunctions array', () => {
      const source = `function greet(name: string): string { return "Hello, " + name; }`;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('greet');
    });

    it('should dispatch arrow functions to topLevelFunctions array', () => {
      const source = `const greet = (name: string): string => "Hello, " + name;`;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('greet');
    });

    it('should handle multiple top-level functions', () => {
      const source = `
        function first() {}
        function second() {}
        const third = () => {};
      `;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.topLevelFunctions).toHaveLength(3);
      expect(result.topLevelFunctions.map((f) => f.name)).toEqual(['first', 'second', 'third']);
    });

    it('should dispatch async functions correctly', () => {
      const source = `async function fetchData(): Promise<void> {}`;
      const tree = parseTypeScript(source, '/test/api.ts');
      const result = extractSymbols(tree, '/test/api.ts');

      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.isSuspend).toBe(true);
    });
  });

  describe('property declarations dispatch', () => {
    it('should dispatch const declaration to topLevelProperties array', () => {
      const source = `const VERSION = "1.0.0";`;
      const tree = parseTypeScript(source, '/test/constants.ts');
      const result = extractSymbols(tree, '/test/constants.ts');

      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('VERSION');
      expect(result.topLevelProperties[0]!.isVal).toBe(true);
    });

    it('should dispatch let declaration to topLevelProperties array', () => {
      const source = `let count = 0;`;
      const tree = parseTypeScript(source, '/test/state.ts');
      const result = extractSymbols(tree, '/test/state.ts');

      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('count');
      expect(result.topLevelProperties[0]!.isVal).toBe(false);
    });

    it('should distinguish variables from arrow functions', () => {
      const source = `
        const value = 42;
        const fn = () => {};
      `;
      const tree = parseTypeScript(source, '/test/mixed.ts');
      const result = extractSymbols(tree, '/test/mixed.ts');

      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('value');
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('fn');
    });
  });

  describe('export statements', () => {
    it('should extract exported class', () => {
      const source = `export class UserService {}`;
      const tree = parseTypeScript(source, '/test/UserService.ts');
      const result = extractSymbols(tree, '/test/UserService.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('UserService');
    });

    it('should extract exported function', () => {
      const source = `export function helper() {}`;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('helper');
    });

    it('should extract exported const', () => {
      const source = `export const VERSION = "1.0";`;
      const tree = parseTypeScript(source, '/test/constants.ts');
      const result = extractSymbols(tree, '/test/constants.ts');

      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('VERSION');
    });

    it('should extract exported interface', () => {
      const source = `export interface Repository {}`;
      const tree = parseTypeScript(source, '/test/types.ts');
      const result = extractSymbols(tree, '/test/types.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Repository');
      expect(result.classes[0]!.kind).toBe('interface');
    });

    it('should extract export default class', () => {
      const source = `export default class Service {}`;
      const tree = parseTypeScript(source, '/test/Service.ts');
      const result = extractSymbols(tree, '/test/Service.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Service');
    });
  });

  describe('mixed declarations', () => {
    it('should correctly categorize all declaration types in a complex file', () => {
      const source = `
        import { Injectable } from '@nestjs/common';

        export interface Repository {
          find(id: string): Entity | null;
        }

        export class UserService {
          getUser(id: string) { return null; }
        }

        enum Status { ACTIVE, INACTIVE }

        export function helper() {}

        export const VERSION = "1.0";

        const privateHelper = () => {};
      `;
      const tree = parseTypeScript(source, '/test/Complex.ts');
      const result = extractSymbols(tree, '/test/Complex.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.classes).toHaveLength(3); // Repository, UserService, Status
      expect(result.topLevelFunctions).toHaveLength(2); // helper, privateHelper
      expect(result.topLevelProperties).toHaveLength(1); // VERSION
    });

    it('should preserve declaration order within each category', () => {
      const source = `
        class First {}
        class Second {}
        class Third {}
      `;
      const tree = parseTypeScript(source, '/test/Order.ts');
      const result = extractSymbols(tree, '/test/Order.ts');

      expect(result.classes.map((c) => c.name)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('class members extraction', () => {
    it('should extract class methods', () => {
      const source = `
        class Service {
          getData(): string { return "data"; }
          async fetchData(): Promise<void> {}
        }
      `;
      const tree = parseTypeScript(source, '/test/Service.ts');
      const result = extractSymbols(tree, '/test/Service.ts');

      expect(result.classes[0]!.functions).toHaveLength(2);
      expect(result.classes[0]!.functions[0]!.name).toBe('getData');
      expect(result.classes[0]!.functions[1]!.name).toBe('fetchData');
    });

    it('should extract class properties', () => {
      const source = `
        class User {
          name: string;
          readonly id: number;
        }
      `;
      const tree = parseTypeScript(source, '/test/User.ts');
      const result = extractSymbols(tree, '/test/User.ts');

      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('name');
      expect(result.classes[0]!.properties[1]!.name).toBe('id');
    });

    it('should extract class with extends and implements', () => {
      const source = `
        class UserService extends BaseService implements Repository {
          find(id: string) { return null; }
        }
      `;
      const tree = parseTypeScript(source, '/test/UserService.ts');
      const result = extractSymbols(tree, '/test/UserService.ts');

      expect(result.classes[0]!.superClass).toBe('BaseService');
      expect(result.classes[0]!.interfaces).toContain('Repository');
    });
  });

  describe('interface members extraction', () => {
    it('should extract interface method signatures', () => {
      const source = `
        interface Repository {
          find(id: string): Entity | null;
          save(entity: Entity): void;
        }
      `;
      const tree = parseTypeScript(source, '/test/Repository.ts');
      const result = extractSymbols(tree, '/test/Repository.ts');

      expect(result.classes[0]!.functions).toHaveLength(2);
      expect(result.classes[0]!.functions[0]!.name).toBe('find');
      expect(result.classes[0]!.functions[1]!.name).toBe('save');
    });

    it('should extract interface property signatures', () => {
      const source = `
        interface Config {
          readonly timeout: number;
          retries?: number;
        }
      `;
      const tree = parseTypeScript(source, '/test/Config.ts');
      const result = extractSymbols(tree, '/test/Config.ts');

      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('timeout');
      expect(result.classes[0]!.properties[1]!.name).toBe('retries');
    });

    it('should extract interface extends', () => {
      const source = `
        interface UserRepository extends Repository, Cacheable {
          findByEmail(email: string): User | null;
        }
      `;
      const tree = parseTypeScript(source, '/test/UserRepository.ts');
      const result = extractSymbols(tree, '/test/UserRepository.ts');

      expect(result.classes[0]!.interfaces).toEqual(['Repository', 'Cacheable']);
    });
  });

  describe('enum members extraction', () => {
    it('should extract enum members', () => {
      const source = `
        enum Status {
          PENDING,
          ACTIVE,
          INACTIVE
        }
      `;
      const tree = parseTypeScript(source, '/test/Status.ts');
      const result = extractSymbols(tree, '/test/Status.ts');

      expect(result.classes[0]!.properties).toHaveLength(3);
      expect(result.classes[0]!.properties.map((p) => p.name)).toEqual(['PENDING', 'ACTIVE', 'INACTIVE']);
    });

    it('should extract enum members with values', () => {
      const source = `
        enum HttpStatus {
          OK = 200,
          NOT_FOUND = 404,
          ERROR = 500
        }
      `;
      const tree = parseTypeScript(source, '/test/HttpStatus.ts');
      const result = extractSymbols(tree, '/test/HttpStatus.ts');

      expect(result.classes[0]!.properties).toHaveLength(3);
      expect(result.classes[0]!.properties[0]!.initializer).toBe('200');
    });
  });

  describe('generics support', () => {
    it('should extract generic class', () => {
      const source = `class Repository<T> {}`;
      const tree = parseTypeScript(source, '/test/Repository.ts');
      const result = extractSymbols(tree, '/test/Repository.ts');

      expect(result.classes[0]!.typeParameters).toHaveLength(1);
      expect(result.classes[0]!.typeParameters![0]!.name).toBe('T');
    });

    it('should extract generic interface with constraints', () => {
      const source = `interface Repository<T extends Entity> {}`;
      const tree = parseTypeScript(source, '/test/Repository.ts');
      const result = extractSymbols(tree, '/test/Repository.ts');

      expect(result.classes[0]!.typeParameters).toHaveLength(1);
      expect(result.classes[0]!.typeParameters![0]!.name).toBe('T');
      expect(result.classes[0]!.typeParameters![0]!.bounds).toContain('Entity');
    });

    it('should extract generic function', () => {
      const source = `function identity<T>(value: T): T { return value; }`;
      const tree = parseTypeScript(source, '/test/utils.ts');
      const result = extractSymbols(tree, '/test/utils.ts');

      expect(result.topLevelFunctions[0]!.typeParameters).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.typeParameters![0]!.name).toBe('T');
    });
  });

  describe('decorators support', () => {
    it('should extract class decorators', () => {
      const source = `
        @Injectable()
        class UserService {}
      `;
      const tree = parseTypeScript(source, '/test/UserService.ts');
      const result = extractSymbols(tree, '/test/UserService.ts');

      expect(result.classes[0]!.annotations).toHaveLength(1);
      expect(result.classes[0]!.annotations[0]!.name).toBe('Injectable');
    });

    it('should extract method decorators', () => {
      const source = `
        class Controller {
          @Get('/users')
          getUsers() {}
        }
      `;
      const tree = parseTypeScript(source, '/test/Controller.ts');
      const result = extractSymbols(tree, '/test/Controller.ts');

      expect(result.classes[0]!.functions[0]!.annotations).toHaveLength(1);
      expect(result.classes[0]!.functions[0]!.annotations[0]!.name).toBe('Get');
    });
  });

  describe('destructuring declarations', () => {
    it('should extract object destructuring', () => {
      const source = `const { name, age } = user;`;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['name', 'age']);
      expect(result.destructuringDeclarations[0]!.initializer).toBe('user');
    });

    it('should extract array destructuring', () => {
      const source = `const [first, second] = items;`;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['first', 'second']);
    });

    it('should handle object destructuring with renaming', () => {
      const source = `const { name: userName, age: userAge } = user;`;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['userName', 'userAge']);
    });

    it('should handle destructuring with default values', () => {
      const source = `const { name = 'default', age = 0 } = user;`;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toContain('name');
      expect(result.destructuringDeclarations[0]!.componentNames).toContain('age');
    });

    it('should handle exported destructuring', () => {
      const source = `export const { name, age } = user;`;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['name', 'age']);
    });

    it('should distinguish const vs let for destructuring', () => {
      const source = `
        const { a } = obj1;
        let { b } = obj2;
      `;
      const tree = parseTypeScript(source, '/test/destructuring.ts');
      const result = extractSymbols(tree, '/test/destructuring.ts');

      expect(result.destructuringDeclarations).toHaveLength(2);
      expect(result.destructuringDeclarations[0]!.isVal).toBe(true);
      expect(result.destructuringDeclarations[1]!.isVal).toBe(false);
    });

    it('should not confuse destructuring with regular variables', () => {
      const source = `
        const { name } = user;
        const age = 30;
        const [first] = items;
      `;
      const tree = parseTypeScript(source, '/test/mixed.ts');
      const result = extractSymbols(tree, '/test/mixed.ts');

      expect(result.destructuringDeclarations).toHaveLength(2);
      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('age');
    });
  });
});
