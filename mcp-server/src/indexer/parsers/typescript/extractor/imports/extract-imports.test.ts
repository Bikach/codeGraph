import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractImports } from './extract-imports.js';

describe('extractImports', () => {
  describe('default imports', () => {
    it('should extract default import', () => {
      const tree = parseTypeScript("import React from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('react');
      expect(imports[0]!.name).toBe('React');
    });

    it('should extract default import from relative path', () => {
      const tree = parseTypeScript("import User from './User';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./User');
      expect(imports[0]!.name).toBe('User');
    });
  });

  describe('named imports', () => {
    it('should extract single named import', () => {
      const tree = parseTypeScript("import { useState } from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('react');
      expect(imports[0]!.name).toBe('useState');
    });

    it('should extract multiple named imports', () => {
      const tree = parseTypeScript("import { useState, useEffect } from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(2);
      expect(imports[0]!.name).toBe('useState');
      expect(imports[1]!.name).toBe('useEffect');
      expect(imports[0]!.path).toBe('react');
      expect(imports[1]!.path).toBe('react');
    });

    it('should extract aliased named import', () => {
      const tree = parseTypeScript("import { Component as Comp } from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.name).toBe('Component');
      expect(imports[0]!.alias).toBe('Comp');
    });

    it('should extract mixed aliased and regular named imports', () => {
      const tree = parseTypeScript("import { useState, useEffect as effect } from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(2);
      expect(imports[0]!.name).toBe('useState');
      expect(imports[0]!.alias).toBeUndefined();
      expect(imports[1]!.name).toBe('useEffect');
      expect(imports[1]!.alias).toBe('effect');
    });
  });

  describe('namespace imports', () => {
    it('should extract namespace import', () => {
      const tree = parseTypeScript("import * as React from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('react');
      expect(imports[0]!.alias).toBe('React');
      expect(imports[0]!.isWildcard).toBe(true);
    });
  });

  describe('side-effect imports', () => {
    it('should extract side-effect import', () => {
      const tree = parseTypeScript("import './styles.css';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./styles.css');
      expect(imports[0]!.name).toBeUndefined();
    });
  });

  describe('type-only imports', () => {
    it('should detect type-only named import', () => {
      const tree = parseTypeScript("import type { User } from './types';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./types');
      expect(imports[0]!.name).toBe('User');
      expect(imports[0]!.isTypeOnly).toBe(true);
    });

    it('should detect type-only default import', () => {
      const tree = parseTypeScript("import type User from './types';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.name).toBe('User');
      expect(imports[0]!.isTypeOnly).toBe(true);
    });

    it('should not mark regular import as type-only', () => {
      const tree = parseTypeScript("import { User } from './types';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(1);
      expect(imports[0]!.isTypeOnly).toBeUndefined();
    });
  });

  describe('combined imports', () => {
    it('should extract default and named imports together', () => {
      const tree = parseTypeScript("import React, { useState } from 'react';", '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(2);
      expect(imports[0]!.name).toBe('React');
      expect(imports[1]!.name).toBe('useState');
    });
  });

  describe('multiple import statements', () => {
    it('should extract imports from multiple statements', () => {
      const code = `
        import React from 'react';
        import { User } from './User';
        import * as utils from './utils';
      `;
      const tree = parseTypeScript(code, '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toHaveLength(3);
      expect(imports[0]!.name).toBe('React');
      expect(imports[1]!.name).toBe('User');
      expect(imports[2]!.alias).toBe('utils');
      expect(imports[2]!.isWildcard).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for file without imports', () => {
      const tree = parseTypeScript('const x = 1;', '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toEqual([]);
    });

    it('should handle empty file', () => {
      const tree = parseTypeScript('', '/test.ts');
      const imports = extractImports(tree.rootNode);
      expect(imports).toEqual([]);
    });
  });
});
