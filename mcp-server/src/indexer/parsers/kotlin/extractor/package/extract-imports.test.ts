import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractImports } from './extract-imports.js';

describe('extractImports', () => {
  it('should extract simple import', () => {
    const tree = parseKotlin('import com.example.User\nclass Test');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('com.example.User');
    expect(imports[0]!.isWildcard).toBe(false);
  });

  it('should extract multiple imports', () => {
    const tree = parseKotlin(`
      import com.example.User
      import com.example.Repository
      class Test
    `);
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(2);
    expect(imports[0]!.path).toBe('com.example.User');
    expect(imports[1]!.path).toBe('com.example.Repository');
  });

  it('should detect wildcard import', () => {
    const tree = parseKotlin('import com.example.*\nclass Test');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('com.example');
    expect(imports[0]!.isWildcard).toBe(true);
  });

  it('should extract import with alias', () => {
    const tree = parseKotlin('import com.example.User as AppUser\nclass Test');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('com.example.User');
    expect(imports[0]!.alias).toBe('AppUser');
  });

  it('should return empty array for file without imports', () => {
    const tree = parseKotlin('class Test');
    const imports = extractImports(tree.rootNode);
    expect(imports).toEqual([]);
  });

  it('should handle imports with package declaration', () => {
    const tree = parseKotlin(`
      package com.myapp
      import com.example.User
      import com.example.Repository
      class Test
    `);
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(2);
  });
});
