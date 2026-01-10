import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { findChildByType, findChildrenByType, findChildByTypes } from './find-child-by-type.js';

describe('findChildByType', () => {
  it('should find first child of given type', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    expect(classDecl).toBeDefined();
    expect(classDecl!.type).toBe('class_declaration');
  });

  it('should return undefined if type not found', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const notFound = findChildByType(tree.rootNode, 'function_declaration');

    expect(notFound).toBeUndefined();
  });

  it('should find identifier in class declaration', () => {
    const tree = parseTypeScript('class MyClass {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const identifier = findChildByType(classDecl!, 'type_identifier');

    expect(identifier).toBeDefined();
    expect(identifier!.text).toBe('MyClass');
  });

  it('should find only first match when multiple exist', () => {
    const tree = parseTypeScript('class Test { a: number; b: number; }', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const firstField = findChildByType(classBody!, 'public_field_definition');

    expect(firstField).toBeDefined();
  });

  it('should find class body', () => {
    const tree = parseTypeScript('class User { name: string; }', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');

    expect(classBody).toBeDefined();
    expect(classBody!.type).toBe('class_body');
  });
});

describe('findChildrenByType', () => {
  it('should find all children of given type', () => {
    const tree = parseTypeScript('class Test { a: number; b: number; c: number; }', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const fields = findChildrenByType(classBody!, 'public_field_definition');

    expect(fields).toHaveLength(3);
  });

  it('should return empty array if type not found', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const methods = findChildrenByType(classDecl!, 'method_definition');

    expect(methods).toEqual([]);
  });

  it('should find all import statements', () => {
    const tree = parseTypeScript(
      `
      import { a } from 'a';
      import { b } from 'b';
      import { c } from 'c';
      class Test {}
    `,
      '/test.ts'
    );
    const imports = findChildrenByType(tree.rootNode, 'import_statement');

    expect(imports).toHaveLength(3);
  });
});

describe('findChildByTypes', () => {
  it('should find first child matching any of the types', () => {
    const tree = parseTypeScript('const x = 1;', '/test.ts');
    const decl = findChildByTypes(tree.rootNode, ['lexical_declaration', 'class_declaration']);

    expect(decl).toBeDefined();
    expect(decl!.type).toBe('lexical_declaration');
  });

  it('should return undefined if no types match', () => {
    const tree = parseTypeScript('const x = 1;', '/test.ts');
    const decl = findChildByTypes(tree.rootNode, ['class_declaration', 'interface_declaration']);

    expect(decl).toBeUndefined();
  });

  it('should find interface or class declaration', () => {
    const tree = parseTypeScript('interface User { name: string; }', '/test.ts');
    const decl = findChildByTypes(tree.rootNode, ['class_declaration', 'interface_declaration']);

    expect(decl).toBeDefined();
    expect(decl!.type).toBe('interface_declaration');
  });
});
