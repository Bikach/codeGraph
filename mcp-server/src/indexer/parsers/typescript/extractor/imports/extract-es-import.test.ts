import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractEsImport } from './extract-es-import.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract imports from an import statement.
 */
function parseImport(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const importNode = findChildByType(tree.rootNode, 'import_statement');
  if (!importNode) return [];
  return extractEsImport(importNode);
}

describe('extractEsImport', () => {
  describe('default imports', () => {
    it('should extract default import', () => {
      const imports = parseImport(`import React from 'react';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        path: 'react',
        name: 'React',
        isTypeOnly: undefined,
      });
    });

    it('should extract default import with relative path', () => {
      const imports = parseImport(`import Component from './Component';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./Component');
      expect(imports[0]!.name).toBe('Component');
    });
  });

  describe('named imports', () => {
    it('should extract single named import', () => {
      const imports = parseImport(`import { useState } from 'react';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        path: 'react',
        name: 'useState',
        alias: undefined,
        isTypeOnly: undefined,
      });
    });

    it('should extract multiple named imports', () => {
      const imports = parseImport(`import { useState, useEffect, useRef } from 'react';`);

      expect(imports).toHaveLength(3);
      expect(imports[0]!.name).toBe('useState');
      expect(imports[1]!.name).toBe('useEffect');
      expect(imports[2]!.name).toBe('useRef');
    });

    it('should extract named import with alias', () => {
      const imports = parseImport(`import { Component as Comp } from 'react';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.name).toBe('Component');
      expect(imports[0]!.alias).toBe('Comp');
    });

    it('should extract mixed named imports with and without aliases', () => {
      const imports = parseImport(`import { useState, Component as Comp, useEffect } from 'react';`);

      expect(imports).toHaveLength(3);
      expect(imports[0]!.name).toBe('useState');
      expect(imports[0]!.alias).toBeUndefined();
      expect(imports[1]!.name).toBe('Component');
      expect(imports[1]!.alias).toBe('Comp');
      expect(imports[2]!.name).toBe('useEffect');
      expect(imports[2]!.alias).toBeUndefined();
    });
  });

  describe('namespace imports', () => {
    it('should extract namespace import', () => {
      const imports = parseImport(`import * as React from 'react';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        path: 'react',
        alias: 'React',
        isWildcard: true,
        isTypeOnly: undefined,
      });
    });

    it('should extract namespace import with different alias', () => {
      const imports = parseImport(`import * as path from 'path';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.alias).toBe('path');
      expect(imports[0]!.isWildcard).toBe(true);
    });
  });

  describe('side-effect imports', () => {
    it('should extract side-effect import', () => {
      const imports = parseImport(`import 'reflect-metadata';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        path: 'reflect-metadata',
        isTypeOnly: undefined,
      });
    });

    it('should extract side-effect import with relative path', () => {
      const imports = parseImport(`import './styles.css';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.path).toBe('./styles.css');
    });
  });

  describe('type imports (TypeScript)', () => {
    it('should extract type-only named import', () => {
      const imports = parseImport(`import type { User } from './types';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.name).toBe('User');
      expect(imports[0]!.isTypeOnly).toBe(true);
    });

    it('should extract type-only default import', () => {
      const imports = parseImport(`import type Config from './config';`);

      expect(imports).toHaveLength(1);
      expect(imports[0]!.name).toBe('Config');
      expect(imports[0]!.isTypeOnly).toBe(true);
    });

    it('should extract multiple type-only imports', () => {
      const imports = parseImport(`import type { User, Post, Comment } from './types';`);

      expect(imports).toHaveLength(3);
      expect(imports.every((i) => i.isTypeOnly)).toBe(true);
    });
  });

  describe('combined imports', () => {
    it('should extract default and named imports together', () => {
      const imports = parseImport(`import React, { useState, useEffect } from 'react';`);

      expect(imports).toHaveLength(3);
      expect(imports[0]!.name).toBe('React');
      expect(imports[1]!.name).toBe('useState');
      expect(imports[2]!.name).toBe('useEffect');
    });

    it('should extract default and namespace imports together', () => {
      const imports = parseImport(`import React, * as ReactTypes from 'react';`);

      expect(imports).toHaveLength(2);
      expect(imports[0]!.name).toBe('React');
      expect(imports[1]!.isWildcard).toBe(true);
      expect(imports[1]!.alias).toBe('ReactTypes');
    });
  });

  describe('path formats', () => {
    it('should handle package imports', () => {
      const imports = parseImport(`import express from 'express';`);
      expect(imports[0]!.path).toBe('express');
    });

    it('should handle scoped package imports', () => {
      const imports = parseImport(`import { Injectable } from '@nestjs/common';`);
      expect(imports[0]!.path).toBe('@nestjs/common');
    });

    it('should handle relative parent imports', () => {
      const imports = parseImport(`import { helper } from '../utils/helper';`);
      expect(imports[0]!.path).toBe('../utils/helper');
    });

    it('should handle absolute imports', () => {
      const imports = parseImport(`import { config } from '/absolute/path/config';`);
      expect(imports[0]!.path).toBe('/absolute/path/config');
    });
  });
});
