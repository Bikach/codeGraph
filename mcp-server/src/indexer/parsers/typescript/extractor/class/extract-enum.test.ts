import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractEnum } from './extract-enum.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract an enum from TypeScript source.
 */
function parseEnum(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const enumNode = findChildByType(tree.rootNode, 'enum_declaration');
  if (!enumNode) throw new Error('No enum found');
  return extractEnum(enumNode);
}

describe('extractEnum', () => {
  describe('basic enum', () => {
    it('should extract enum name', () => {
      const e = parseEnum(`enum Status {}`);

      expect(e.name).toBe('Status');
      expect(e.kind).toBe('enum');
    });

    it('should extract empty enum', () => {
      const e = parseEnum(`enum Empty {}`);

      expect(e.properties).toEqual([]);
    });
  });

  describe('enum members without values', () => {
    it('should extract single member', () => {
      const e = parseEnum(`enum Status { ACTIVE }`);

      expect(e.properties).toHaveLength(1);
      expect(e.properties[0]!.name).toBe('ACTIVE');
      expect(e.properties[0]!.isVal).toBe(true);
    });

    it('should extract multiple members', () => {
      const e = parseEnum(`
        enum Status {
          PENDING,
          ACTIVE,
          INACTIVE
        }
      `);

      expect(e.properties).toHaveLength(3);
      expect(e.properties.map((p) => p.name)).toEqual(['PENDING', 'ACTIVE', 'INACTIVE']);
    });
  });

  describe('enum members with numeric values', () => {
    it('should extract member with value', () => {
      const e = parseEnum(`enum Status { ACTIVE = 1 }`);

      expect(e.properties).toHaveLength(1);
      expect(e.properties[0]!.name).toBe('ACTIVE');
      expect(e.properties[0]!.initializer).toBe('1');
    });

    it('should extract multiple members with values', () => {
      const e = parseEnum(`
        enum HttpStatus {
          OK = 200,
          NOT_FOUND = 404,
          ERROR = 500
        }
      `);

      expect(e.properties).toHaveLength(3);
      expect(e.properties[0]!.initializer).toBe('200');
      expect(e.properties[1]!.initializer).toBe('404');
      expect(e.properties[2]!.initializer).toBe('500');
    });

    it('should extract mixed members with and without values', () => {
      const e = parseEnum(`
        enum Priority {
          LOW,
          MEDIUM = 5,
          HIGH
        }
      `);

      expect(e.properties).toHaveLength(3);
      expect(e.properties[0]!.initializer).toBeUndefined();
      expect(e.properties[1]!.initializer).toBe('5');
      expect(e.properties[2]!.initializer).toBeUndefined();
    });
  });

  describe('string enums', () => {
    it('should extract string enum member', () => {
      const e = parseEnum(`enum Direction { UP = "UP" }`);

      expect(e.properties).toHaveLength(1);
      expect(e.properties[0]!.initializer).toBe('"UP"');
    });

    it('should extract multiple string members', () => {
      const e = parseEnum(`
        enum Direction {
          UP = "up",
          DOWN = "down",
          LEFT = "left",
          RIGHT = "right"
        }
      `);

      expect(e.properties).toHaveLength(4);
      expect(e.properties.map((p) => p.name)).toEqual(['UP', 'DOWN', 'LEFT', 'RIGHT']);
    });
  });

  describe('const enum', () => {
    it('should mark const enum with isSealed', () => {
      const e = parseEnum(`const enum Status { ACTIVE, INACTIVE }`);

      expect(e.name).toBe('Status');
      expect(e.isSealed).toBe(true);
    });

    it('should not mark regular enum as sealed', () => {
      const e = parseEnum(`enum Status { ACTIVE, INACTIVE }`);

      expect(e.isSealed).toBe(false);
    });
  });

  describe('enum visibility', () => {
    it('should have public visibility by default', () => {
      const e = parseEnum(`enum Status {}`);

      expect(e.visibility).toBe('public');
    });
  });

  describe('computed values', () => {
    it('should extract computed numeric values', () => {
      const e = parseEnum(`
        enum Bits {
          A = 1 << 0,
          B = 1 << 1,
          C = 1 << 2
        }
      `);

      expect(e.properties).toHaveLength(3);
      expect(e.properties[0]!.initializer).toBe('1 << 0');
    });
  });

  describe('enum member properties', () => {
    it('should mark all members as readonly (isVal)', () => {
      const e = parseEnum(`
        enum Status {
          PENDING,
          ACTIVE
        }
      `);

      expect(e.properties.every((p) => p.isVal)).toBe(true);
    });

    it('should set visibility to public for all members', () => {
      const e = parseEnum(`
        enum Status {
          PENDING,
          ACTIVE
        }
      `);

      expect(e.properties.every((p) => p.visibility === 'public')).toBe(true);
    });
  });
});
