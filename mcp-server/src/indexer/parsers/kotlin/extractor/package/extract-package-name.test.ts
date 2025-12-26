import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractPackageName } from './extract-package-name.js';

describe('extractPackageName', () => {
  it('should extract simple package name', () => {
    const tree = parseKotlin('package com.example\nclass User');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example');
  });

  it('should extract nested package name', () => {
    const tree = parseKotlin('package com.example.service.user\nclass User');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example.service.user');
  });

  it('should return undefined for file without package', () => {
    const tree = parseKotlin('class User');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBeUndefined();
  });

  it('should extract package with single segment', () => {
    const tree = parseKotlin('package app\nclass User');
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('app');
  });

  it('should handle package with imports after', () => {
    const tree = parseKotlin(`
      package com.example
      import kotlin.collections.List
      class User
    `);
    const packageName = extractPackageName(tree.rootNode);
    expect(packageName).toBe('com.example');
  });
});
