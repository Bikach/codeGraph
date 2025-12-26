import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../parser.js';
import { extractSymbols } from './extract-symbols.js';

describe('extractSymbols', () => {
  describe('basic structure', () => {
    it('should return ParsedFile with correct filePath and language', () => {
      const source = `package com.example`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Example.kt');

      expect(result.filePath).toBe('/test/Example.kt');
      expect(result.language).toBe('kotlin');
    });

    it('should initialize all arrays as empty when no declarations', () => {
      const source = `package com.example`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Empty.kt');

      expect(result.classes).toEqual([]);
      expect(result.topLevelFunctions).toEqual([]);
      expect(result.topLevelProperties).toEqual([]);
      expect(result.typeAliases).toEqual([]);
      expect(result.destructuringDeclarations).toEqual([]);
      expect(result.objectExpressions).toEqual([]);
    });

    it('should handle empty file', () => {
      const source = ``;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Empty.kt');

      expect(result.packageName).toBeUndefined();
      expect(result.imports).toEqual([]);
      expect(result.classes).toEqual([]);
    });
  });

  describe('package and imports', () => {
    it('should extract package name', () => {
      const source = `package com.example.service`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Service.kt');

      expect(result.packageName).toBe('com.example.service');
    });

    it('should extract imports', () => {
      const source = `
        package com.example
        import kotlin.collections.List
        import com.example.domain.*
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Service.kt');

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]!.path).toBe('kotlin.collections.List');
      expect(result.imports[1]!.path).toBe('com.example.domain');
      expect(result.imports[1]!.isWildcard).toBe(true);
    });
  });

  describe('class declarations dispatch', () => {
    it('should dispatch class_declaration to classes array', () => {
      const source = `class UserService`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/UserService.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('UserService');
      expect(result.classes[0]!.kind).toBe('class');
    });

    it('should dispatch interface_declaration to classes array', () => {
      const source = `interface Repository`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Repository.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Repository');
      expect(result.classes[0]!.kind).toBe('interface');
    });

    it('should dispatch object_declaration to classes array', () => {
      const source = `object Singleton`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Singleton.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Singleton');
      expect(result.classes[0]!.kind).toBe('object');
    });

    it('should dispatch enum_class_declaration to classes array', () => {
      const source = `enum class Status { PENDING, ACTIVE }`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Status.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Status');
      expect(result.classes[0]!.kind).toBe('enum');
    });

    it('should dispatch annotation_declaration to classes array', () => {
      const source = `annotation class Validated`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Validated.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Validated');
      expect(result.classes[0]!.kind).toBe('annotation');
    });

    it('should handle multiple class-like declarations', () => {
      const source = `
        class Service
        interface Repository
        object Config
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Multi.kt');

      expect(result.classes).toHaveLength(3);
      expect(result.classes.map(c => c.name)).toEqual(['Service', 'Repository', 'Config']);
    });
  });

  describe('function declarations dispatch', () => {
    it('should dispatch function_declaration to topLevelFunctions array', () => {
      const source = `fun greet(name: String): String = "Hello, $name"`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/utils.kt');

      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('greet');
    });

    it('should handle multiple top-level functions', () => {
      const source = `
        fun first() {}
        fun second() {}
        fun third() {}
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/utils.kt');

      expect(result.topLevelFunctions).toHaveLength(3);
      expect(result.topLevelFunctions.map(f => f.name)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('property declarations dispatch', () => {
    it('should dispatch property_declaration to topLevelProperties array', () => {
      const source = `val VERSION = "1.0.0"`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/constants.kt');

      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('VERSION');
    });

    it('should dispatch destructuring declaration to destructuringDeclarations array', () => {
      const source = `val (first, second) = Pair("a", "b")`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/test.kt');

      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['first', 'second']);
      expect(result.topLevelProperties).toHaveLength(0);
    });

    it('should correctly distinguish properties from destructuring', () => {
      const source = `
        val simple = "value"
        val (a, b) = pair
        var count = 0
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/mixed.kt');

      expect(result.topLevelProperties).toHaveLength(2);
      expect(result.topLevelProperties.map(p => p.name)).toEqual(['simple', 'count']);
      expect(result.destructuringDeclarations).toHaveLength(1);
    });
  });

  describe('type alias dispatch', () => {
    it('should dispatch type_alias to typeAliases array', () => {
      const source = `typealias UserList = List<User>`;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/types.kt');

      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]!.name).toBe('UserList');
    });

    it('should handle multiple type aliases', () => {
      const source = `
        typealias StringMap = Map<String, String>
        typealias Handler = (String) -> Unit
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/types.kt');

      expect(result.typeAliases).toHaveLength(2);
      expect(result.typeAliases.map(t => t.name)).toEqual(['StringMap', 'Handler']);
    });
  });

  describe('object expressions extraction', () => {
    it('should extract object expressions from function bodies', () => {
      const source = `
        fun createListener(): Listener {
          return object : Listener {
            override fun onEvent() {}
          }
        }
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/test.kt');

      expect(result.objectExpressions.length).toBeGreaterThan(0);
      expect(result.objectExpressions[0]!.superTypes).toContain('Listener');
    });
  });

  describe('mixed declarations', () => {
    it('should correctly categorize all declaration types in a complex file', () => {
      const source = `
        package com.example

        import kotlin.collections.List

        typealias UserList = List<User>

        interface Repository {
          fun find(id: String): Entity?
        }

        class UserService(val repo: Repository) {
          fun getUser(id: String) = repo.find(id)
        }

        object Config {
          val timeout = 30
        }

        fun helper() {}

        val VERSION = "1.0"

        val (x, y) = coordinates
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Complex.kt');

      expect(result.packageName).toBe('com.example');
      expect(result.imports).toHaveLength(1);
      expect(result.typeAliases).toHaveLength(1);
      expect(result.classes).toHaveLength(3); // Repository, UserService, Config
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.destructuringDeclarations).toHaveLength(1);
    });

    it('should preserve declaration order within each category', () => {
      const source = `
        class First
        class Second
        class Third
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Order.kt');

      expect(result.classes.map(c => c.name)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('nested classes support', () => {
    it('should extract nested classes within parent classes', () => {
      const source = `
        class Outer {
          class Inner {
            fun innerMethod() {}
          }
        }
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/Nested.kt');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Outer');
      expect(result.classes[0]!.nestedClasses).toHaveLength(1);
      expect(result.classes[0]!.nestedClasses[0]!.name).toBe('Inner');
    });

    it('should extract companion objects', () => {
      const source = `
        class User {
          companion object {
            fun create(): User = User()
          }
        }
      `;
      const tree = parseKotlin(source);
      const result = extractSymbols(tree, '/test/User.kt');

      expect(result.classes[0]!.companionObject).toBeDefined();
      expect(result.classes[0]!.companionObject!.functions).toHaveLength(1);
      expect(result.classes[0]!.companionObject!.functions[0]!.name).toBe('create');
    });
  });
});
