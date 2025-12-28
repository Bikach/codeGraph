import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType, findChildrenByType } from './find-child-by-type.js';

describe('findChildByType', () => {
  it('should find first child of given type', () => {
    const tree = parseJava('class User {}');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    expect(classDecl).toBeDefined();
    expect(classDecl!.type).toBe('class_declaration');
  });

  it('should return undefined if type not found', () => {
    const tree = parseJava('class User {}');
    const notFound = findChildByType(tree.rootNode, 'method_declaration');

    expect(notFound).toBeUndefined();
  });

  it('should find identifier in class declaration', () => {
    const tree = parseJava('class MyClass {}');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const identifier = findChildByType(classDecl!, 'identifier');

    expect(identifier).toBeDefined();
    expect(identifier!.text).toBe('MyClass');
  });

  it('should find only first match when multiple exist', () => {
    const tree = parseJava('class Test { int a; int b; }');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const firstField = findChildByType(classBody!, 'field_declaration');

    expect(firstField).toBeDefined();
  });

  it('should find class body', () => {
    const tree = parseJava('class User { String name; }');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');

    expect(classBody).toBeDefined();
    expect(classBody!.type).toBe('class_body');
  });

  it('should find modifiers', () => {
    const tree = parseJava('public class User {}');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');

    expect(modifiers).toBeDefined();
  });
});

describe('findChildrenByType', () => {
  it('should find all children of given type', () => {
    const tree = parseJava('class Test { int a; int b; int c; }');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const fields = findChildrenByType(classBody!, 'field_declaration');

    expect(fields).toHaveLength(3);
  });

  it('should return empty array if type not found', () => {
    const tree = parseJava('class User {}');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const methods = findChildrenByType(classDecl!, 'method_declaration');

    expect(methods).toEqual([]);
  });

  it('should find all import declarations', () => {
    const tree = parseJava(`
      import java.util.List;
      import java.util.Map;
      import java.util.Set;
      class Test {}
    `);
    const imports = findChildrenByType(tree.rootNode, 'import_declaration');

    expect(imports).toHaveLength(3);
  });
});
