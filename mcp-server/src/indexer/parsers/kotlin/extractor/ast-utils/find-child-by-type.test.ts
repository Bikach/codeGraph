import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from './find-child-by-type.js';

describe('findChildByType', () => {
  it('should find a child node by type', () => {
    const tree = parseKotlin('class User');
    const root = tree.rootNode;
    const classDecl = findChildByType(root, 'class_declaration');
    expect(classDecl).toBeDefined();
    expect(classDecl!.type).toBe('class_declaration');
  });

  it('should return undefined if child type not found', () => {
    const tree = parseKotlin('class User');
    const root = tree.rootNode;
    const interfaceDecl = findChildByType(root, 'interface_declaration');
    expect(interfaceDecl).toBeUndefined();
  });

  it('should find first matching child when multiple exist', () => {
    const tree = parseKotlin('class A\nclass B');
    const root = tree.rootNode;
    const classDecl = findChildByType(root, 'class_declaration');
    expect(classDecl).toBeDefined();
    // Should find the first class (A)
    const nameNode = classDecl!.childForFieldName('name') ?? findChildByType(classDecl!, 'type_identifier');
    expect(nameNode?.text).toBe('A');
  });

  it('should find nested child types', () => {
    const tree = parseKotlin(`
      class User {
        val name: String = ""
      }
    `);
    const root = tree.rootNode;
    const classDecl = findChildByType(root, 'class_declaration');
    expect(classDecl).toBeDefined();

    const classBody = findChildByType(classDecl!, 'class_body');
    expect(classBody).toBeDefined();

    const property = findChildByType(classBody!, 'property_declaration');
    expect(property).toBeDefined();
  });

  it('should work with package_header', () => {
    const tree = parseKotlin('package com.example');
    const root = tree.rootNode;
    const packageHeader = findChildByType(root, 'package_header');
    expect(packageHeader).toBeDefined();
    expect(packageHeader!.type).toBe('package_header');
  });

  it('should work with import_list', () => {
    const tree = parseKotlin(`
      import com.example.User
      import com.example.Repository
    `);
    const root = tree.rootNode;
    const importList = findChildByType(root, 'import_list');
    expect(importList).toBeDefined();
  });
});
