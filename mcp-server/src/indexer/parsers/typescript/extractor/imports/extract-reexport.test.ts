import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractReexport, extractReexports, isReexportStatement } from './extract-reexport.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract re-exports from an export statement.
 */
function parseReexport(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const exportNode = findChildByType(tree.rootNode, 'export_statement');
  if (!exportNode) return [];
  return extractReexport(exportNode);
}

/**
 * Helper to check if an export is a re-export statement.
 */
function checkIsReexport(source: string): boolean {
  const tree = parseTypeScript(source, '/test.ts');
  const exportNode = findChildByType(tree.rootNode, 'export_statement');
  if (!exportNode) return false;
  return isReexportStatement(exportNode);
}

describe('isReexportStatement', () => {
  it('should return true for named re-export', () => {
    expect(checkIsReexport(`export { foo } from './module';`)).toBe(true);
  });

  it('should return true for wildcard re-export', () => {
    expect(checkIsReexport(`export * from './module';`)).toBe(true);
  });

  it('should return true for namespace re-export', () => {
    expect(checkIsReexport(`export * as utils from './utils';`)).toBe(true);
  });

  it('should return false for regular export declaration', () => {
    expect(checkIsReexport(`export const foo = 1;`)).toBe(false);
  });

  it('should return false for export clause without from', () => {
    expect(checkIsReexport(`export { foo, bar };`)).toBe(false);
  });
});

describe('extractReexport', () => {
  describe('named re-exports', () => {
    it('should extract named re-export without alias', () => {
      const reexports = parseReexport(`export { foo } from './module';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './module',
        originalName: 'foo',
        exportedName: 'foo',
        isTypeOnly: undefined,
      });
    });

    it('should extract named re-export with alias', () => {
      const reexports = parseReexport(`export { foo as bar } from './module';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './module',
        originalName: 'foo',
        exportedName: 'bar',
        isTypeOnly: undefined,
      });
    });

    it('should extract multiple named re-exports', () => {
      const reexports = parseReexport(`export { foo, bar, baz } from './module';`);

      expect(reexports).toHaveLength(3);
      expect(reexports[0]!.originalName).toBe('foo');
      expect(reexports[1]!.originalName).toBe('bar');
      expect(reexports[2]!.originalName).toBe('baz');
    });

    it('should extract mixed named re-exports with and without aliases', () => {
      const reexports = parseReexport(`export { foo, bar as renamedBar, baz } from './module';`);

      expect(reexports).toHaveLength(3);
      expect(reexports[0]).toEqual({
        sourcePath: './module',
        originalName: 'foo',
        exportedName: 'foo',
        isTypeOnly: undefined,
      });
      expect(reexports[1]).toEqual({
        sourcePath: './module',
        originalName: 'bar',
        exportedName: 'renamedBar',
        isTypeOnly: undefined,
      });
      expect(reexports[2]).toEqual({
        sourcePath: './module',
        originalName: 'baz',
        exportedName: 'baz',
        isTypeOnly: undefined,
      });
    });
  });

  describe('default re-exports', () => {
    it('should extract default re-export with alias', () => {
      const reexports = parseReexport(`export { default as Component } from './Component';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './Component',
        originalName: 'default',
        exportedName: 'Component',
        isTypeOnly: undefined,
      });
    });

    it('should extract default re-export without alias', () => {
      const reexports = parseReexport(`export { default } from './module';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './module',
        originalName: 'default',
        exportedName: 'default',
        isTypeOnly: undefined,
      });
    });
  });

  describe('namespace re-exports', () => {
    it('should extract namespace re-export', () => {
      const reexports = parseReexport(`export * as utils from './utils';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './utils',
        exportedName: 'utils',
        isNamespaceReexport: true,
        isTypeOnly: undefined,
      });
    });

    it('should extract namespace re-export with scoped package', () => {
      const reexports = parseReexport(`export * as testing from '@testing-library/react';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]!.sourcePath).toBe('@testing-library/react');
      expect(reexports[0]!.exportedName).toBe('testing');
      expect(reexports[0]!.isNamespaceReexport).toBe(true);
    });
  });

  describe('wildcard re-exports', () => {
    it('should extract wildcard re-export', () => {
      const reexports = parseReexport(`export * from './module';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './module',
        isWildcard: true,
        isTypeOnly: undefined,
      });
    });

    it('should extract wildcard re-export from package', () => {
      const reexports = parseReexport(`export * from 'some-package';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]!.sourcePath).toBe('some-package');
      expect(reexports[0]!.isWildcard).toBe(true);
    });
  });

  describe('type re-exports (TypeScript)', () => {
    it('should extract type-only named re-export', () => {
      const reexports = parseReexport(`export type { User } from './types';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './types',
        originalName: 'User',
        exportedName: 'User',
        isTypeOnly: true,
      });
    });

    it('should extract type-only named re-export with alias', () => {
      const reexports = parseReexport(`export type { User as AppUser } from './types';`);

      expect(reexports).toHaveLength(1);
      expect(reexports[0]).toEqual({
        sourcePath: './types',
        originalName: 'User',
        exportedName: 'AppUser',
        isTypeOnly: true,
      });
    });

    it('should extract multiple type-only re-exports', () => {
      const reexports = parseReexport(`export type { User, Post, Comment } from './types';`);

      expect(reexports).toHaveLength(3);
      expect(reexports.every((r) => r.isTypeOnly)).toBe(true);
    });
  });

  describe('path formats', () => {
    it('should handle relative path', () => {
      const reexports = parseReexport(`export { foo } from './module';`);
      expect(reexports[0]!.sourcePath).toBe('./module');
    });

    it('should handle parent relative path', () => {
      const reexports = parseReexport(`export { foo } from '../utils/helper';`);
      expect(reexports[0]!.sourcePath).toBe('../utils/helper');
    });

    it('should handle scoped package path', () => {
      const reexports = parseReexport(`export { Injectable } from '@nestjs/common';`);
      expect(reexports[0]!.sourcePath).toBe('@nestjs/common');
    });

    it('should handle absolute path', () => {
      const reexports = parseReexport(`export { config } from '/absolute/path/config';`);
      expect(reexports[0]!.sourcePath).toBe('/absolute/path/config');
    });
  });
});

describe('extractReexports', () => {
  it('should extract all re-exports from a module', () => {
    const source = `
      export { foo as bar } from './module1';
      export * as utils from './utils';
      export { default as Component } from './Component';
      export * from './module2';
      export type { User } from './types';
    `;
    const tree = parseTypeScript(source, '/test.ts');
    const reexports = extractReexports(tree.rootNode);

    expect(reexports).toHaveLength(5);
    expect(reexports[0]!.exportedName).toBe('bar');
    expect(reexports[1]!.isNamespaceReexport).toBe(true);
    expect(reexports[2]!.originalName).toBe('default');
    expect(reexports[3]!.isWildcard).toBe(true);
    expect(reexports[4]!.isTypeOnly).toBe(true);
  });

  it('should ignore regular exports', () => {
    const source = `
      export const foo = 1;
      export function bar() {}
      export { baz } from './module';
    `;
    const tree = parseTypeScript(source, '/test.ts');
    const reexports = extractReexports(tree.rootNode);

    expect(reexports).toHaveLength(1);
    expect(reexports[0]!.originalName).toBe('baz');
  });

  it('should return empty array for no re-exports', () => {
    const source = `
      import { foo } from './module';
      export const bar = foo;
    `;
    const tree = parseTypeScript(source, '/test.ts');
    const reexports = extractReexports(tree.rootNode);

    expect(reexports).toHaveLength(0);
  });
});
