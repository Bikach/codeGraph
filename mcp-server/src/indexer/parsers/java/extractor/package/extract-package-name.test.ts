import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractPackageName } from './extract-package-name.js';

describe('extractPackageName', () => {
  it('should extract simple package name', () => {
    const tree = parseJava('package com.example; class User {}');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example');
  });

  it('should extract nested package name', () => {
    const tree = parseJava('package com.example.service.user; class User {}');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example.service.user');
  });

  it('should return undefined for file without package', () => {
    const tree = parseJava('class User {}');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBeUndefined();
  });

  it('should extract package with single segment', () => {
    const tree = parseJava('package app; class User {}');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('app');
  });

  it('should handle package with imports after', () => {
    const tree = parseJava(`
      package com.example;
      import java.util.List;
      class User {}
    `);
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example');
  });

  it('should handle package with annotations before class', () => {
    const tree = parseJava(`
      package com.example;
      @SuppressWarnings("unchecked")
      public class User {}
    `);
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example');
  });
});
