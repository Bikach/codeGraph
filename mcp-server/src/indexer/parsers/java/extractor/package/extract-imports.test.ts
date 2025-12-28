import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractImports } from './extract-imports.js';

describe('extractImports', () => {
  it('should extract simple import', () => {
    const tree = parseJava('import com.example.User; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('com.example.User');
    expect(imports[0]!.isWildcard).toBe(false);
  });

  it('should extract multiple imports', () => {
    const tree = parseJava(`
      import com.example.User;
      import com.example.Repository;
      class Test {}
    `);
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(2);
    expect(imports[0]!.path).toBe('com.example.User');
    expect(imports[1]!.path).toBe('com.example.Repository');
  });

  it('should detect wildcard import', () => {
    const tree = parseJava('import com.example.*; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('com.example');
    expect(imports[0]!.isWildcard).toBe(true);
  });

  it('should return empty array for file without imports', () => {
    const tree = parseJava('class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toEqual([]);
  });

  it('should handle imports with package declaration', () => {
    const tree = parseJava(`
      package com.myapp;
      import com.example.User;
      import com.example.Repository;
      class Test {}
    `);
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(2);
  });

  it('should extract static import', () => {
    const tree = parseJava('import static java.lang.Math.PI; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('static:java.lang.Math.PI');
    expect(imports[0]!.isWildcard).toBe(false);
  });

  it('should extract static wildcard import', () => {
    const tree = parseJava('import static java.util.Collections.*; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('static:java.util.Collections');
    expect(imports[0]!.isWildcard).toBe(true);
  });

  it('should handle mixed static and regular imports', () => {
    const tree = parseJava(`
      import java.util.List;
      import static java.lang.Math.PI;
      import java.util.Map;
      import static java.util.Collections.*;
      class Test {}
    `);
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(4);
    expect(imports[0]!.path).toBe('java.util.List');
    expect(imports[1]!.path).toBe('static:java.lang.Math.PI');
    expect(imports[2]!.path).toBe('java.util.Map');
    expect(imports[3]!.path).toBe('static:java.util.Collections');
    expect(imports[3]!.isWildcard).toBe(true);
  });

  it('should not have alias (Java does not support import aliases)', () => {
    const tree = parseJava('import com.example.User; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports[0]!.alias).toBeUndefined();
  });

  it('should extract java.lang imports', () => {
    const tree = parseJava('import java.lang.String; class Test {}');
    const imports = extractImports(tree.rootNode);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('java.lang.String');
  });
});
