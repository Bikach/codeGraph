import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import {
  extractNamespace,
  unwrapNamespaceFromExpression,
  isNamespaceNode,
} from './extract-namespace.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSymbols } from '../extract-symbols.js';

/**
 * Helper to parse and extract a namespace from TypeScript source.
 * Handles both `namespace` and `module` keywords.
 */
function parseNamespace(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const root = tree.rootNode;

  // Try to find internal_module (namespace keyword)
  let namespaceNode = findChildByType(root, 'internal_module');

  // If not found directly, check in expression_statement
  if (!namespaceNode) {
    for (const child of root.children) {
      if (child.type === 'expression_statement') {
        const inner = findChildByType(child, 'internal_module');
        if (inner) {
          namespaceNode = inner;
          break;
        }
      }
    }
  }

  // Try to find module (legacy module keyword)
  if (!namespaceNode) {
    namespaceNode = findChildByType(root, 'module');
  }

  if (!namespaceNode) throw new Error('No namespace found');
  return extractNamespace(namespaceNode);
}

describe('extractNamespace', () => {
  describe('basic namespace', () => {
    it('should extract namespace name', () => {
      const ns = parseNamespace(`namespace MyApp {}`);

      expect(ns.name).toBe('MyApp');
      expect(ns.kind).toBe('object');
    });

    it('should extract empty namespace', () => {
      const ns = parseNamespace(`namespace Empty {}`);

      expect(ns.functions).toEqual([]);
      expect(ns.properties).toEqual([]);
      expect(ns.nestedClasses).toEqual([]);
    });

    it('should have public visibility by default', () => {
      const ns = parseNamespace(`namespace Public {}`);

      expect(ns.visibility).toBe('public');
    });
  });

  describe('namespace with exported members', () => {
    it('should extract exported class', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export class User {}
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('User');
      expect(ns.nestedClasses[0]!.kind).toBe('class');
    });

    it('should extract exported function', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export function init() {}
        }
      `);

      expect(ns.functions).toHaveLength(1);
      expect(ns.functions[0]!.name).toBe('init');
    });

    it('should extract exported variable', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export const VERSION = "1.0";
        }
      `);

      expect(ns.properties).toHaveLength(1);
      expect(ns.properties[0]!.name).toBe('VERSION');
    });

    it('should extract exported interface', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export interface Config {
            name: string;
          }
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('Config');
      expect(ns.nestedClasses[0]!.kind).toBe('interface');
    });

    it('should extract exported enum', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export enum Status {
            Active,
            Inactive
          }
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('Status');
      expect(ns.nestedClasses[0]!.kind).toBe('enum');
    });

    it('should extract multiple exported members', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export class User {}
          export function init() {}
          export const VERSION = "1.0";
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.functions).toHaveLength(1);
      expect(ns.properties).toHaveLength(1);
    });
  });

  describe('nested namespaces', () => {
    it('should extract nested namespace', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          namespace Utils {
            export function helper() {}
          }
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('Utils');
      expect(ns.nestedClasses[0]!.kind).toBe('object');
    });

    it('should extract deeply nested namespaces', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          namespace Services {
            namespace Database {
              export class Connection {}
            }
          }
        }
      `);

      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('Services');

      const services = ns.nestedClasses[0]!;
      expect(services.nestedClasses).toHaveLength(1);
      expect(services.nestedClasses[0]!.name).toBe('Database');

      const database = services.nestedClasses[0]!;
      expect(database.nestedClasses).toHaveLength(1);
      expect(database.nestedClasses[0]!.name).toBe('Connection');
    });

    it('should extract exported nested namespace', () => {
      const ns = parseNamespace(`
        namespace MyApp {
          export namespace Public {
            export function api() {}
          }
        }
      `);

      // Exported nested namespace is still treated as a nested class
      expect(ns.nestedClasses).toHaveLength(1);
      expect(ns.nestedClasses[0]!.name).toBe('Public');
    });
  });

  describe('module keyword (legacy syntax)', () => {
    it('should extract module with legacy syntax', () => {
      const ns = parseNamespace(`module LegacyModule {}`);

      expect(ns.name).toBe('LegacyModule');
      expect(ns.kind).toBe('object');
    });

    it('should mark legacy module with annotation', () => {
      const ns = parseNamespace(`module LegacyModule {}`);

      expect(ns.annotations).toContainEqual({ name: 'module' });
    });

    it('should extract members from legacy module', () => {
      const ns = parseNamespace(`
        module LegacyModule {
          export const VERSION = "1.0";
        }
      `);

      expect(ns.properties).toHaveLength(1);
      expect(ns.properties[0]!.name).toBe('VERSION');
    });

    it('should not mark namespace keyword as legacy module', () => {
      const ns = parseNamespace(`namespace ModernNamespace {}`);

      expect(ns.annotations).not.toContainEqual({ name: 'module' });
    });
  });

  describe('namespace merging (declaration merging)', () => {
    it('should extract both declarations separately via extractSymbols', () => {
      const source = `
        namespace MyApp {
          export class User {}
        }

        namespace MyApp {
          export function init() {}
        }
      `;

      const tree = parseTypeScript(source, '/test.ts');
      const result = extractSymbols(tree, '/test.ts');

      // Both namespace declarations should be extracted
      expect(result.classes).toHaveLength(2);
      expect(result.classes[0]!.name).toBe('MyApp');
      expect(result.classes[1]!.name).toBe('MyApp');
    });
  });

  describe('helper functions', () => {
    it('isNamespaceNode should identify internal_module', () => {
      const tree = parseTypeScript(`namespace Test {}`, '/test.ts');
      const root = tree.rootNode;

      // Find the internal_module node
      let found = false;
      for (const child of root.children) {
        if (child.type === 'expression_statement') {
          const inner = findChildByType(child, 'internal_module');
          if (inner) {
            expect(isNamespaceNode(inner)).toBe(true);
            found = true;
          }
        }
      }
      expect(found).toBe(true);
    });

    it('isNamespaceNode should identify module', () => {
      const tree = parseTypeScript(`module Test {}`, '/test.ts');
      const moduleNode = findChildByType(tree.rootNode, 'module');

      expect(moduleNode).not.toBeNull();
      expect(isNamespaceNode(moduleNode!)).toBe(true);
    });

    it('isNamespaceNode should return false for non-namespace nodes', () => {
      const tree = parseTypeScript(`class Test {}`, '/test.ts');
      const classNode = findChildByType(tree.rootNode, 'class_declaration');

      expect(classNode).not.toBeNull();
      expect(isNamespaceNode(classNode!)).toBe(false);
    });

    it('unwrapNamespaceFromExpression should extract from expression_statement', () => {
      const tree = parseTypeScript(`namespace Test {}`, '/test.ts');
      const root = tree.rootNode;

      for (const child of root.children) {
        if (child.type === 'expression_statement') {
          const ns = unwrapNamespaceFromExpression(child);
          expect(ns).not.toBeUndefined();
          expect(ns?.type).toBe('internal_module');
        }
      }
    });

    it('unwrapNamespaceFromExpression should return undefined for non-namespace expressions', () => {
      const tree = parseTypeScript(`console.log("hello")`, '/test.ts');
      const root = tree.rootNode;

      for (const child of root.children) {
        if (child.type === 'expression_statement') {
          const ns = unwrapNamespaceFromExpression(child);
          expect(ns).toBeUndefined();
        }
      }
    });
  });

  describe('integration with extractSymbols', () => {
    it('should extract namespace at top level', () => {
      const source = `
        namespace MyApp {
          export class User {}
        }
      `;

      const tree = parseTypeScript(source, '/test.ts');
      const result = extractSymbols(tree, '/test.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('MyApp');
      expect(result.classes[0]!.kind).toBe('object');
    });

    it('should extract exported namespace', () => {
      const source = `
        export namespace PublicAPI {
          export function call() {}
        }
      `;

      const tree = parseTypeScript(source, '/test.ts');
      const result = extractSymbols(tree, '/test.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('PublicAPI');
    });

    it('should extract module keyword at top level', () => {
      const source = `
        module LegacyModule {
          export const value = 42;
        }
      `;

      const tree = parseTypeScript(source, '/test.ts');
      const result = extractSymbols(tree, '/test.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('LegacyModule');
    });
  });
});
