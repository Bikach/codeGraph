import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { extractTypeName } from './extract-type-name.js';
import { findChildByType } from './find-child-by-type.js';

describe('extractTypeName', () => {
  it('should extract simple type name from user_type', () => {
    const tree = parseKotlin('class User : BaseEntity()');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const delegationSpec = findChildByType(classDecl!, 'delegation_specifier');
    const constructorInvocation = findChildByType(delegationSpec!, 'constructor_invocation');
    const userType = findChildByType(constructorInvocation!, 'user_type');

    const typeName = extractTypeName(userType!);
    expect(typeName).toBe('BaseEntity');
  });

  it('should extract type name from constructor_invocation', () => {
    const tree = parseKotlin('class User : BaseEntity()');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const delegationSpec = findChildByType(classDecl!, 'delegation_specifier');
    const constructorInvocation = findChildByType(delegationSpec!, 'constructor_invocation');

    const typeName = extractTypeName(constructorInvocation!);
    expect(typeName).toBe('BaseEntity');
  });

  it('should extract type name from interface implementation', () => {
    const tree = parseKotlin('class User : Serializable');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const delegationSpec = findChildByType(classDecl!, 'delegation_specifier');
    const userType = findChildByType(delegationSpec!, 'user_type');

    const typeName = extractTypeName(userType!);
    expect(typeName).toBe('Serializable');
  });

  it('should return full text for generic type without simple_identifier child', () => {
    // user_type for generic types has type_identifier, not simple_identifier
    // So extractTypeName returns the full text
    const tree = parseKotlin('class User : Comparable<User>');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const delegationSpec = findChildByType(classDecl!, 'delegation_specifier');
    const userType = findChildByType(delegationSpec!, 'user_type');

    const typeName = extractTypeName(userType!);
    // Returns full text because user_type has type_identifier, not simple_identifier
    expect(typeName).toBe('Comparable<User>');
  });

  it('should handle qualified type name', () => {
    const tree = parseKotlin('val x: com.example.User = User()');
    const propDecl = findChildByType(tree.rootNode, 'property_declaration');
    const varDecl = findChildByType(propDecl!, 'variable_declaration');
    const userType = findChildByType(varDecl!, 'user_type');

    // Returns the full text for qualified names
    const typeName = extractTypeName(userType!);
    expect(typeName).toContain('example');
  });

  it('should return text for other node types', () => {
    const tree = parseKotlin('val x: String? = null');
    const propDecl = findChildByType(tree.rootNode, 'property_declaration');
    const varDecl = findChildByType(propDecl!, 'variable_declaration');
    const nullableType = findChildByType(varDecl!, 'nullable_type');

    const typeName = extractTypeName(nullableType!);
    expect(typeName).toBe('String?');
  });
});
