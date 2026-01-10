import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractTypeName, extractFullTypeName } from './extract-type-name.js';
import { findChildByType } from './find-child-by-type.js';
import { findNodeByType } from './traverse-node.js';

describe('extractTypeName', () => {
  function getTypeAnnotation(code: string) {
    const tree = parseTypeScript(code, '/test.ts');
    return findNodeByType(tree.rootNode, 'type_annotation');
  }

  it('should extract type from type_annotation', () => {
    const typeNode = getTypeAnnotation('const x: string = "hello";');
    expect(extractTypeName(typeNode!)).toBe('string');
  });

  it('should extract predefined type', () => {
    const typeNode = getTypeAnnotation('const x: number = 42;');
    expect(extractTypeName(typeNode!)).toBe('number');
  });

  it('should extract type identifier', () => {
    const typeNode = getTypeAnnotation('const user: User = new User();');
    expect(extractTypeName(typeNode!)).toBe('User');
  });

  it('should extract base type from generic type', () => {
    const typeNode = getTypeAnnotation('const items: Array<string> = [];');
    expect(extractTypeName(typeNode!)).toBe('Array');
  });

  it('should handle undefined input', () => {
    expect(extractTypeName(undefined)).toBeUndefined();
  });
});

describe('extractFullTypeName', () => {
  function getTypeAnnotation(code: string) {
    const tree = parseTypeScript(code, '/test.ts');
    return findNodeByType(tree.rootNode, 'type_annotation');
  }

  it('should return full generic type', () => {
    const typeNode = getTypeAnnotation('const items: Array<string> = [];');
    expect(extractFullTypeName(typeNode!)).toBe('Array<string>');
  });

  it('should return full array type', () => {
    const typeNode = getTypeAnnotation('const numbers: number[] = [];');
    expect(extractFullTypeName(typeNode!)).toBe('number[]');
  });

  it('should return full union type', () => {
    const typeNode = getTypeAnnotation('const value: string | number = "test";');
    expect(extractFullTypeName(typeNode!)).toBe('string | number');
  });

  it('should return full intersection type', () => {
    const typeNode = getTypeAnnotation('const value: A & B = {} as A & B;');
    expect(extractFullTypeName(typeNode!)).toBe('A & B');
  });

  it('should handle undefined input', () => {
    expect(extractFullTypeName(undefined)).toBeUndefined();
  });
});
