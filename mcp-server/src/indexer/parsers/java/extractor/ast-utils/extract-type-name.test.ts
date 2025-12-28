import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractTypeName, extractFullTypeName } from './extract-type-name.js';
import { findChildByType } from './find-child-by-type.js';

describe('extractTypeName', () => {
  function getFieldType(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const fieldDecl = findChildByType(classBody!, 'field_declaration');
    // Type is typically the first child after modifiers
    const typeNode = fieldDecl!.children.find(
      (c) =>
        c.type === 'type_identifier' ||
        c.type === 'generic_type' ||
        c.type === 'array_type' ||
        c.type === 'integral_type'
    );
    return typeNode;
  }

  it('should extract simple type identifier', () => {
    const typeNode = getFieldType('class Test { String name; }');
    expect(extractTypeName(typeNode!)).toBe('String');
  });

  it('should extract primitive type', () => {
    const typeNode = getFieldType('class Test { int count; }');
    expect(extractTypeName(typeNode!)).toBe('int');
  });

  it('should extract base type from generic type', () => {
    const typeNode = getFieldType('class Test { List<String> items; }');
    expect(extractTypeName(typeNode!)).toBe('List');
  });

  it('should extract element type from array type', () => {
    const typeNode = getFieldType('class Test { int[] numbers; }');
    expect(extractTypeName(typeNode!)).toBe('int');
  });

  it('should handle nested generics', () => {
    const typeNode = getFieldType('class Test { Map<String, List<Integer>> data; }');
    expect(extractTypeName(typeNode!)).toBe('Map');
  });
});

describe('extractFullTypeName', () => {
  function getFieldType(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const fieldDecl = findChildByType(classBody!, 'field_declaration');
    const typeNode = fieldDecl!.children.find(
      (c) =>
        c.type === 'type_identifier' ||
        c.type === 'generic_type' ||
        c.type === 'array_type' ||
        c.type === 'integral_type'
    );
    return typeNode;
  }

  it('should return full generic type', () => {
    const typeNode = getFieldType('class Test { List<String> items; }');
    expect(extractFullTypeName(typeNode!)).toBe('List<String>');
  });

  it('should return full array type', () => {
    const typeNode = getFieldType('class Test { int[] numbers; }');
    expect(extractFullTypeName(typeNode!)).toBe('int[]');
  });

  it('should return full nested generic type', () => {
    const typeNode = getFieldType('class Test { Map<String, List<Integer>> data; }');
    expect(extractFullTypeName(typeNode!)).toBe('Map<String, List<Integer>>');
  });
});
