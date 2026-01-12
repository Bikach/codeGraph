import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractInterfaceBody } from './extract-interface-body.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract interface body from TypeScript source.
 */
function parseInterfaceBody(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const interfaceNode = findChildByType(tree.rootNode, 'interface_declaration');
  if (!interfaceNode) throw new Error('No interface found');
  const interfaceBody = findChildByType(interfaceNode, 'interface_body');
  return extractInterfaceBody(interfaceBody);
}

describe('extractInterfaceBody', () => {
  describe('empty interface', () => {
    it('should return empty arrays for empty interface', () => {
      const { properties, functions } = parseInterfaceBody(`interface Empty {}`);

      expect(properties).toEqual([]);
      expect(functions).toEqual([]);
    });

    it('should handle undefined input', () => {
      const { properties, functions } = extractInterfaceBody(undefined);

      expect(properties).toEqual([]);
      expect(functions).toEqual([]);
    });
  });

  describe('property signatures', () => {
    it('should extract property signature', () => {
      const { properties } = parseInterfaceBody(`
        interface Config {
          timeout: number;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('timeout');
    });

    it('should extract multiple properties', () => {
      const { properties } = parseInterfaceBody(`
        interface User {
          id: number;
          name: string;
          email?: string;
        }
      `);

      expect(properties).toHaveLength(3);
      expect(properties.map((p) => p.name)).toEqual(['id', 'name', 'email']);
    });
  });

  describe('method signatures', () => {
    it('should extract method signature', () => {
      const { functions } = parseInterfaceBody(`
        interface Repository {
          find(id: string): Entity | null;
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('find');
    });

    it('should extract multiple methods', () => {
      const { functions } = parseInterfaceBody(`
        interface Repository {
          find(id: string): Entity | null;
          save(entity: Entity): void;
          delete(id: string): boolean;
        }
      `);

      expect(functions).toHaveLength(3);
      expect(functions.map((f) => f.name)).toEqual(['find', 'save', 'delete']);
    });
  });

  describe('call signatures', () => {
    it('should extract call signature as [[call]] function', () => {
      const { functions } = parseInterfaceBody(`
        interface Formatter {
          (value: string): string;
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('[[call]]');
      expect(functions[0]!.visibility).toBe('public');
      expect(functions[0]!.isAbstract).toBe(true);
    });

    it('should have valid location for call signature', () => {
      const { functions } = parseInterfaceBody(`
        interface Formatter {
          (value: string): string;
        }
      `);

      expect(functions[0]!.location).toBeDefined();
      expect(functions[0]!.location.startLine).toBeGreaterThan(0);
      expect(functions[0]!.location.endLine).toBeGreaterThanOrEqual(functions[0]!.location.startLine);
      expect(functions[0]!.location.startColumn).toBeGreaterThan(0);
      expect(functions[0]!.location.endColumn).toBeGreaterThan(0);
    });

    it('should extract multiple call signatures', () => {
      const { functions } = parseInterfaceBody(`
        interface Overloaded {
          (x: string): string;
          (x: number): number;
        }
      `);

      expect(functions).toHaveLength(2);
      expect(functions.every((f) => f.name === '[[call]]')).toBe(true);
    });
  });

  describe('construct signatures', () => {
    it('should extract construct signature as [[construct]] function', () => {
      const { functions } = parseInterfaceBody(`
        interface Constructor {
          new (name: string): Instance;
        }
      `);

      expect(functions).toHaveLength(1);
      expect(functions[0]!.name).toBe('[[construct]]');
      expect(functions[0]!.visibility).toBe('public');
      expect(functions[0]!.isAbstract).toBe(true);
    });

    it('should have valid location for construct signature', () => {
      const { functions } = parseInterfaceBody(`
        interface Constructor {
          new (name: string): Instance;
        }
      `);

      expect(functions[0]!.location).toBeDefined();
      expect(functions[0]!.location.startLine).toBeGreaterThan(0);
      expect(functions[0]!.location.endLine).toBeGreaterThanOrEqual(functions[0]!.location.startLine);
      expect(functions[0]!.location.startColumn).toBeGreaterThan(0);
      expect(functions[0]!.location.endColumn).toBeGreaterThan(0);
    });
  });

  describe('index signatures', () => {
    it('should extract index signature as [[index]] property', () => {
      const { properties } = parseInterfaceBody(`
        interface Dictionary {
          [key: string]: string;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('[[index]]');
      expect(properties[0]!.visibility).toBe('public');
    });

    it('should have valid location for index signature', () => {
      const { properties } = parseInterfaceBody(`
        interface Dictionary {
          [key: string]: string;
        }
      `);

      expect(properties[0]!.location).toBeDefined();
      expect(properties[0]!.location.startLine).toBeGreaterThan(0);
      expect(properties[0]!.location.endLine).toBeGreaterThanOrEqual(properties[0]!.location.startLine);
      expect(properties[0]!.location.startColumn).toBeGreaterThan(0);
      expect(properties[0]!.location.endColumn).toBeGreaterThan(0);
    });

    it('should capture index signature text as type', () => {
      const { properties } = parseInterfaceBody(`
        interface Dictionary {
          [key: string]: number;
        }
      `);

      expect(properties[0]!.type).toBe('[key: string]: number');
    });

    it('should extract number indexed signature', () => {
      const { properties } = parseInterfaceBody(`
        interface ArrayLike {
          [index: number]: string;
        }
      `);

      expect(properties).toHaveLength(1);
      expect(properties[0]!.name).toBe('[[index]]');
    });
  });

  describe('mixed interface members', () => {
    it('should extract all member types', () => {
      const { properties, functions } = parseInterfaceBody(`
        interface MixedInterface {
          name: string;
          [key: string]: any;
          (value: string): void;
          new (): MixedInterface;
          method(): void;
        }
      `);

      // Properties: name + [[index]]
      expect(properties).toHaveLength(2);
      expect(properties.map((p) => p.name)).toContain('name');
      expect(properties.map((p) => p.name)).toContain('[[index]]');

      // Functions: [[call]] + [[construct]] + method
      expect(functions).toHaveLength(3);
      expect(functions.map((f) => f.name)).toContain('[[call]]');
      expect(functions.map((f) => f.name)).toContain('[[construct]]');
      expect(functions.map((f) => f.name)).toContain('method');
    });

    it('should have valid locations for all special members', () => {
      const { properties, functions } = parseInterfaceBody(`
        interface MixedInterface {
          [key: string]: any;
          (value: string): void;
          new (): MixedInterface;
        }
      `);

      // Check [[index]] location
      const indexProp = properties.find((p) => p.name === '[[index]]');
      expect(indexProp!.location.startLine).toBeGreaterThan(0);

      // Check [[call]] location
      const callFunc = functions.find((f) => f.name === '[[call]]');
      expect(callFunc!.location.startLine).toBeGreaterThan(0);

      // Check [[construct]] location
      const constructFunc = functions.find((f) => f.name === '[[construct]]');
      expect(constructFunc!.location.startLine).toBeGreaterThan(0);
    });
  });
});
