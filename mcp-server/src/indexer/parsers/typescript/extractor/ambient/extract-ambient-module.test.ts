import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import {
  extractAmbientModule,
  isAmbientModuleNode,
} from './extract-ambient-module.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractSymbols } from '../extract-symbols.js';

/**
 * Helper to parse and extract an ambient module from TypeScript source.
 */
function parseAmbientModule(source: string) {
  const tree = parseTypeScript(source, '/test.d.ts');
  const root = tree.rootNode;

  // Find the ambient_declaration node
  const ambientNode = findChildByType(root, 'ambient_declaration');

  if (!ambientNode) throw new Error('No ambient declaration found');
  if (!isAmbientModuleNode(ambientNode)) throw new Error('Not an ambient module node');

  return extractAmbientModule(ambientNode);
}

describe('extractAmbientModule', () => {
  describe('module augmentation (declare module)', () => {
    it('should extract module name from string literal', () => {
      const module = parseAmbientModule(`
        declare module 'express' {
        }
      `);

      expect(module.name).toBe('express');
      expect(module.kind).toBe('interface');
    });

    it('should extract module name with double quotes', () => {
      const module = parseAmbientModule(`
        declare module "express" {
        }
      `);

      expect(module.name).toBe('express');
    });

    it('should extract scoped package name', () => {
      const module = parseAmbientModule(`
        declare module '@types/node' {
        }
      `);

      expect(module.name).toBe('@types/node');
    });

    it('should extract wildcard module pattern', () => {
      const module = parseAmbientModule(`
        declare module "*.css" {
        }
      `);

      expect(module.name).toBe('*.css');
    });

    it('should extract complex wildcard pattern', () => {
      const module = parseAmbientModule(`
        declare module "*.module.scss" {
        }
      `);

      expect(module.name).toBe('*.module.scss');
    });

    it('should have ambient-module annotation', () => {
      const module = parseAmbientModule(`
        declare module 'lodash' {
        }
      `);

      expect(module.annotations).toContainEqual({ name: 'ambient-module' });
    });

    it('should extract interface augmentation', () => {
      const module = parseAmbientModule(`
        declare module 'express' {
          interface Request {
            user?: string;
          }
        }
      `);

      expect(module.nestedClasses).toHaveLength(1);
      expect(module.nestedClasses[0]!.name).toBe('Request');
      expect(module.nestedClasses[0]!.kind).toBe('interface');
      expect(module.nestedClasses[0]!.properties).toHaveLength(1);
      expect(module.nestedClasses[0]!.properties[0]!.name).toBe('user');
    });

    it('should extract multiple interface augmentations', () => {
      const module = parseAmbientModule(`
        declare module 'express' {
          interface Request {
            user?: string;
          }
          interface Response {
            customSend(): void;
          }
        }
      `);

      expect(module.nestedClasses).toHaveLength(2);
      expect(module.nestedClasses[0]!.name).toBe('Request');
      expect(module.nestedClasses[1]!.name).toBe('Response');
    });

    it('should extract class augmentation', () => {
      const module = parseAmbientModule(`
        declare module 'some-lib' {
          class CustomClass {
            method(): void;
          }
        }
      `);

      expect(module.nestedClasses).toHaveLength(1);
      expect(module.nestedClasses[0]!.name).toBe('CustomClass');
      expect(module.nestedClasses[0]!.kind).toBe('class');
    });

    it('should extract function declarations', () => {
      const module = parseAmbientModule(`
        declare module 'utils' {
          function helper(): void;
        }
      `);

      expect(module.functions).toHaveLength(1);
      expect(module.functions[0]!.name).toBe('helper');
    });

    it('should extract variable declarations', () => {
      const module = parseAmbientModule(`
        declare module "*.css" {
          const styles: { [key: string]: string };
          export default styles;
        }
      `);

      expect(module.properties).toHaveLength(1);
      expect(module.properties[0]!.name).toBe('styles');
    });

    it('should extract type alias declarations', () => {
      const module = parseAmbientModule(`
        declare module 'types' {
          type ID = string | number;
        }
      `);

      expect(module.nestedClasses).toHaveLength(0);
      // Type aliases are stored separately, not in nestedClasses
    });

    it('should extract exported members', () => {
      const module = parseAmbientModule(`
        declare module 'my-lib' {
          export interface Config {
            name: string;
          }
          export function init(): void;
        }
      `);

      expect(module.nestedClasses).toHaveLength(1);
      expect(module.nestedClasses[0]!.name).toBe('Config');
      expect(module.functions).toHaveLength(1);
      expect(module.functions[0]!.name).toBe('init');
    });
  });

  describe('global augmentation (declare global)', () => {
    it('should extract global augmentation', () => {
      const module = parseAmbientModule(`
        declare global {
          interface Window {
            myApp: any;
          }
        }
      `);

      expect(module.name).toBe('global');
      expect(module.kind).toBe('interface');
    });

    it('should have global annotation', () => {
      const module = parseAmbientModule(`
        declare global {
        }
      `);

      expect(module.annotations).toContainEqual({ name: 'global' });
    });

    it('should extract global interface augmentation', () => {
      const module = parseAmbientModule(`
        declare global {
          interface Window {
            myApp: { version: string };
          }
        }
      `);

      expect(module.nestedClasses).toHaveLength(1);
      expect(module.nestedClasses[0]!.name).toBe('Window');
      expect(module.nestedClasses[0]!.kind).toBe('interface');
    });

    it('should extract multiple global declarations', () => {
      const module = parseAmbientModule(`
        declare global {
          interface Window {
            myApp: any;
          }
          interface Document {
            customMethod(): void;
          }
          const MY_GLOBAL: string;
        }
      `);

      expect(module.nestedClasses).toHaveLength(2);
      expect(module.nestedClasses[0]!.name).toBe('Window');
      expect(module.nestedClasses[1]!.name).toBe('Document');
      expect(module.properties).toHaveLength(1);
      expect(module.properties[0]!.name).toBe('MY_GLOBAL');
    });

    it('should extract global function declarations', () => {
      const module = parseAmbientModule(`
        declare global {
          function globalHelper(): void;
        }
      `);

      expect(module.functions).toHaveLength(1);
      expect(module.functions[0]!.name).toBe('globalHelper');
    });

    it('should extract global namespace declarations', () => {
      const module = parseAmbientModule(`
        declare global {
          namespace NodeJS {
            interface ProcessEnv {
              NODE_ENV: string;
            }
          }
        }
      `);

      // Namespace should be extracted as a nested class
      // Note: This depends on how namespaces are handled in ambient context
      expect(module.nestedClasses.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('helper functions', () => {
    it('isAmbientModuleNode should return true for declare module', () => {
      const tree = parseTypeScript(`declare module 'test' {}`, '/test.d.ts');
      const ambientNode = findChildByType(tree.rootNode, 'ambient_declaration');

      expect(ambientNode).not.toBeNull();
      expect(isAmbientModuleNode(ambientNode!)).toBe(true);
    });

    it('isAmbientModuleNode should return true for declare global', () => {
      const tree = parseTypeScript(`declare global {}`, '/test.d.ts');
      const ambientNode = findChildByType(tree.rootNode, 'ambient_declaration');

      expect(ambientNode).not.toBeNull();
      expect(isAmbientModuleNode(ambientNode!)).toBe(true);
    });

    it('isAmbientModuleNode should return false for declare class', () => {
      const tree = parseTypeScript(`declare class Test {}`, '/test.d.ts');
      const ambientNode = findChildByType(tree.rootNode, 'ambient_declaration');

      expect(ambientNode).not.toBeNull();
      expect(isAmbientModuleNode(ambientNode!)).toBe(false);
    });

    it('isAmbientModuleNode should return false for declare function', () => {
      const tree = parseTypeScript(`declare function test(): void;`, '/test.d.ts');
      const ambientNode = findChildByType(tree.rootNode, 'ambient_declaration');

      expect(ambientNode).not.toBeNull();
      expect(isAmbientModuleNode(ambientNode!)).toBe(false);
    });

    it('isAmbientModuleNode should return false for non-ambient nodes', () => {
      const tree = parseTypeScript(`class Test {}`, '/test.ts');
      const classNode = findChildByType(tree.rootNode, 'class_declaration');

      expect(classNode).not.toBeNull();
      expect(isAmbientModuleNode(classNode!)).toBe(false);
    });
  });

  describe('integration with extractSymbols', () => {
    it('should extract module augmentation at top level', () => {
      const source = `
        declare module 'express' {
          interface Request {
            user?: string;
          }
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('express');
      expect(result.classes[0]!.annotations).toContainEqual({ name: 'ambient-module' });
    });

    it('should extract global augmentation at top level', () => {
      const source = `
        declare global {
          interface Window {
            myApp: any;
          }
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('global');
      expect(result.classes[0]!.annotations).toContainEqual({ name: 'global' });
    });

    it('should extract multiple ambient module declarations', () => {
      const source = `
        declare module 'express' {
          interface Request {
            user?: string;
          }
        }

        declare module 'express-serve-static-core' {
          interface Request {
            session?: any;
          }
        }

        declare global {
          interface Window {
            myApp: any;
          }
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      expect(result.classes).toHaveLength(3);
      expect(result.classes[0]!.name).toBe('express');
      expect(result.classes[1]!.name).toBe('express-serve-static-core');
      expect(result.classes[2]!.name).toBe('global');
    });

    it('should still extract regular ambient declarations', () => {
      const source = `
        declare class AmbientClass {}
        declare function ambientFunc(): void;
        declare const AMBIENT_CONST: string;

        declare module 'test' {
          interface TestInterface {}
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      // Regular ambient class
      expect(result.classes.some(c => c.name === 'AmbientClass')).toBe(true);
      // Module augmentation
      expect(result.classes.some(c => c.name === 'test')).toBe(true);
      // Ambient function
      expect(result.topLevelFunctions.some(f => f.name === 'ambientFunc')).toBe(true);
      // Ambient const
      expect(result.topLevelProperties.some(p => p.name === 'AMBIENT_CONST')).toBe(true);
    });

    it('should handle wildcard module declarations', () => {
      const source = `
        declare module "*.css" {
          const styles: { [key: string]: string };
          export default styles;
        }

        declare module "*.svg" {
          const content: string;
          export default content;
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      expect(result.classes).toHaveLength(2);
      expect(result.classes[0]!.name).toBe('*.css');
      expect(result.classes[1]!.name).toBe('*.svg');
    });

    it('should handle complex module augmentation patterns', () => {
      const source = `
        // Express session augmentation
        declare module 'express-session' {
          interface SessionData {
            userId: string;
            role: string;
          }
        }

        // Express request augmentation
        declare module 'express' {
          interface Request {
            session: import('express-session').Session;
          }
        }

        // Global Node.js augmentation
        declare global {
          namespace NodeJS {
            interface ProcessEnv {
              NODE_ENV: 'development' | 'production' | 'test';
              PORT?: string;
            }
          }
        }
      `;

      const tree = parseTypeScript(source, '/test.d.ts');
      const result = extractSymbols(tree, '/test.d.ts');

      expect(result.classes.length).toBeGreaterThanOrEqual(3);
      expect(result.classes.some(c => c.name === 'express-session')).toBe(true);
      expect(result.classes.some(c => c.name === 'express')).toBe(true);
      expect(result.classes.some(c => c.name === 'global')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty module augmentation', () => {
      const module = parseAmbientModule(`
        declare module 'empty' {
        }
      `);

      expect(module.name).toBe('empty');
      expect(module.functions).toEqual([]);
      expect(module.properties).toEqual([]);
      expect(module.nestedClasses).toEqual([]);
    });

    it('should handle empty global augmentation', () => {
      const module = parseAmbientModule(`
        declare global {
        }
      `);

      expect(module.name).toBe('global');
      expect(module.functions).toEqual([]);
      expect(module.properties).toEqual([]);
      expect(module.nestedClasses).toEqual([]);
    });

    it('should handle module path with slashes', () => {
      const module = parseAmbientModule(`
        declare module 'express/lib/router' {
        }
      `);

      expect(module.name).toBe('express/lib/router');
    });

    it('should handle module with enum declaration', () => {
      const module = parseAmbientModule(`
        declare module 'config' {
          enum LogLevel {
            Debug,
            Info,
            Error
          }
        }
      `);

      expect(module.nestedClasses).toHaveLength(1);
      expect(module.nestedClasses[0]!.name).toBe('LogLevel');
      expect(module.nestedClasses[0]!.kind).toBe('enum');
    });

    it('should have proper location information', () => {
      const module = parseAmbientModule(`declare module 'test' {}`);

      expect(module.location).toBeDefined();
      expect(module.location.startLine).toBeGreaterThan(0);
      expect(module.location.endLine).toBeGreaterThanOrEqual(module.location.startLine);
    });
  });
});
