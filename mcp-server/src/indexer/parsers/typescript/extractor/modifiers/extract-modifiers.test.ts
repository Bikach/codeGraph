import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractModifiers } from './extract-modifiers.js';

describe('extractModifiers', () => {
  function getClassModifiers(code: string) {
    const tree = parseTypeScript(code, '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    return extractModifiers(classDecl!);
  }

  function getMethodModifiers(code: string) {
    const tree = parseTypeScript(code, '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDef = findChildByType(classBody!, 'method_definition');
    return extractModifiers(methodDef!);
  }

  function getPropertyModifiers(code: string) {
    const tree = parseTypeScript(code, '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const publicField = findChildByType(classBody!, 'public_field_definition');
    return extractModifiers(publicField!);
  }

  describe('visibility', () => {
    it('should extract public visibility (explicit)', () => {
      const modifiers = getPropertyModifiers('class User { public name: string; }');
      expect(modifiers.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const modifiers = getPropertyModifiers('class User { private name: string; }');
      expect(modifiers.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const modifiers = getPropertyModifiers('class User { protected name: string; }');
      expect(modifiers.visibility).toBe('protected');
    });

    it('should default to public when no visibility modifier', () => {
      const modifiers = getClassModifiers('class User {}');
      expect(modifiers.visibility).toBe('public');
    });
  });

  describe('class modifiers', () => {
    it('should extract abstract modifier', () => {
      // Abstract classes are parsed as abstract_class_declaration in tree-sitter-typescript
      const tree = parseTypeScript('abstract class Shape {}', '/test.ts');
      const abstractClassDecl = findChildByType(tree.rootNode, 'abstract_class_declaration');
      const modifiers = extractModifiers(abstractClassDecl!);
      expect(modifiers.isAbstract).toBe(true);
    });

    it('should not have abstract when not present', () => {
      const modifiers = getClassModifiers('class User {}');
      expect(modifiers.isAbstract).toBe(false);
    });
  });

  describe('method modifiers', () => {
    it('should extract async modifier', () => {
      const modifiers = getMethodModifiers('class Test { async run() {} }');
      expect(modifiers.isAsync).toBe(true);
    });

    it('should extract static modifier', () => {
      const modifiers = getMethodModifiers('class Test { static create() {} }');
      expect(modifiers.isStatic).toBe(true);
    });

    it('should not have static when not present', () => {
      const modifiers = getMethodModifiers('class Test { run() {} }');
      expect(modifiers.isStatic).toBe(false);
    });
  });

  describe('property modifiers', () => {
    it('should extract readonly modifier', () => {
      const modifiers = getPropertyModifiers('class Test { readonly name: string; }');
      expect(modifiers.isReadonly).toBe(true);
    });

    it('should extract static modifier', () => {
      const modifiers = getPropertyModifiers('class Test { static count: number; }');
      expect(modifiers.isStatic).toBe(true);
    });

    it('should extract multiple modifiers', () => {
      const modifiers = getPropertyModifiers('class Test { private static readonly VALUE: number; }');
      expect(modifiers.visibility).toBe('private');
      expect(modifiers.isStatic).toBe(true);
      expect(modifiers.isReadonly).toBe(true);
    });
  });

  describe('export modifiers', () => {
    it('should detect export for exported class', () => {
      const tree = parseTypeScript('export class User {}', '/test.ts');
      const exportStmt = findChildByType(tree.rootNode, 'export_statement');
      const classDecl = findChildByType(exportStmt!, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.isExport).toBe(true);
      expect(modifiers.isDefault).toBe(false);
    });

    it('should detect export default', () => {
      const tree = parseTypeScript('export default class User {}', '/test.ts');
      const exportStmt = findChildByType(tree.rootNode, 'export_statement');
      const classDecl = findChildByType(exportStmt!, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.isExport).toBe(true);
      expect(modifiers.isDefault).toBe(true);
    });

    it('should not detect export for non-exported class', () => {
      const modifiers = getClassModifiers('class User {}');
      expect(modifiers.isExport).toBe(false);
      expect(modifiers.isDefault).toBe(false);
    });
  });

  describe('default values', () => {
    it('should return all false flags for minimal class', () => {
      const modifiers = getClassModifiers('class User {}');
      expect(modifiers.visibility).toBe('public');
      expect(modifiers.isAbstract).toBe(false);
      expect(modifiers.isStatic).toBe(false);
      expect(modifiers.isReadonly).toBe(false);
      expect(modifiers.isAsync).toBe(false);
      expect(modifiers.isExport).toBe(false);
      expect(modifiers.isDefault).toBe(false);
    });
  });
});
