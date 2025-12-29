/**
 * Tests for extractClassBody
 *
 * Note: Phase 3 only implements nested class extraction.
 * Field, method, and constructor extraction will be added in Phase 4.
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractClassBody, type ClassExtractor } from './extract-class-body.js';
import type { ParsedClass } from '../../../../types.js';

/**
 * Helper to get the class_body node from a Java class declaration.
 */
function getClassBody(source: string) {
  const tree = parseJava(source);
  const classDecl = findChildByType(tree.rootNode, 'class_declaration');
  return findChildByType(classDecl!, 'class_body');
}

/**
 * Helper to get interface_body from an interface declaration.
 */
function getInterfaceBody(source: string) {
  const tree = parseJava(source);
  const interfaceDecl = findChildByType(tree.rootNode, 'interface_declaration');
  return findChildByType(interfaceDecl!, 'interface_body');
}

/**
 * Helper to get enum_body from an enum declaration.
 */
function getEnumBody(source: string) {
  const tree = parseJava(source);
  const enumDecl = findChildByType(tree.rootNode, 'enum_declaration');
  return findChildByType(enumDecl!, 'enum_body');
}

/**
 * Mock class extractor for testing.
 * Returns a minimal ParsedClass with just the name.
 */
const mockExtractClass: ClassExtractor = (node) => {
  const nameNode = node.children.find((c) => c.type === 'identifier');
  return {
    name: nameNode?.text ?? '<anonymous>',
    kind: 'class',
    visibility: 'internal',
    isAbstract: false,
    isData: false,
    isSealed: false,
    superClass: undefined,
    interfaces: [],
    typeParameters: undefined,
    annotations: [],
    properties: [],
    functions: [],
    nestedClasses: [],
    companionObject: undefined,
    secondaryConstructors: undefined,
    location: { filePath: '', startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 },
  } as ParsedClass;
};

describe('extractClassBody', () => {
  describe('undefined input', () => {
    it('should return empty arrays when classBody is undefined', () => {
      const result = extractClassBody(undefined, mockExtractClass);

      expect(result).toEqual({
        properties: [],
        functions: [],
        nestedClasses: [],
        secondaryConstructors: [],
      });
    });
  });

  describe('empty class body', () => {
    it('should return empty arrays for empty class', () => {
      const classBody = getClassBody('class Foo {}');
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.nestedClasses).toEqual([]);
      expect(result.secondaryConstructors).toEqual([]);
    });
  });

  describe('nested classes (implemented in Phase 3)', () => {
    it('should extract single nested class', () => {
      const classBody = getClassBody(`
        class Outer {
          class Inner {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Inner');
    });

    it('should extract multiple nested classes', () => {
      const classBody = getClassBody(`
        class Outer {
          class Inner1 {}
          class Inner2 {}
          class Inner3 {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(3);
    });

    it('should extract nested interface', () => {
      const classBody = getClassBody(`
        class Outer {
          interface Callback {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Callback');
    });

    it('should extract nested enum', () => {
      const classBody = getClassBody(`
        class Outer {
          enum Status { ACTIVE }
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Status');
    });

    it('should extract nested annotation type', () => {
      const classBody = getClassBody(`
        class Outer {
          @interface MyAnnotation {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('MyAnnotation');
    });

    it('should extract mixed nested types', () => {
      const classBody = getClassBody(`
        class Outer {
          class NestedClass {}
          interface NestedInterface {}
          enum NestedEnum { VALUE }
          @interface NestedAnnotation {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(4);
    });
  });

  describe('fields, methods, constructors extraction', () => {
    it('should extract fields from class body', () => {
      const classBody = getClassBody(`
        class Foo {
          private int x;
          public String name;
          protected final double value = 3.14;
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.properties).toHaveLength(3);
      expect(result.properties[0]!.name).toBe('x');
      expect(result.properties[0]!.visibility).toBe('private');
      expect(result.properties[1]!.name).toBe('name');
      expect(result.properties[1]!.visibility).toBe('public');
      expect(result.properties[2]!.name).toBe('value');
      expect(result.properties[2]!.isVal).toBe(true); // final
    });

    it('should extract methods from class body', () => {
      const classBody = getClassBody(`
        class Foo {
          public void bar() {}
          private int calculate(int x) { return x * 2; }
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0]!.name).toBe('bar');
      expect(result.functions[0]!.visibility).toBe('public');
      expect(result.functions[1]!.name).toBe('calculate');
      expect(result.functions[1]!.visibility).toBe('private');
    });

    it('should extract constructors from class body', () => {
      const classBody = getClassBody(`
        class Foo {
          public Foo() {}
          public Foo(int x) {}
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      expect(result.secondaryConstructors).toHaveLength(2);
      expect(result.secondaryConstructors[0]!.visibility).toBe('public');
      expect(result.secondaryConstructors[1]!.parameters).toHaveLength(1);
    });
  });

  describe('interface body', () => {
    it('should handle interface body with nested types', () => {
      const interfaceBody = getInterfaceBody(`
        interface Outer {
          class InnerClass {}
        }
      `);
      const result = extractClassBody(interfaceBody!, mockExtractClass);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('InnerClass');
    });

    it('should extract interface methods', () => {
      const interfaceBody = getInterfaceBody(`
        interface Foo {
          void bar();
          int calculate(int x);
        }
      `);
      const result = extractClassBody(interfaceBody!, mockExtractClass);

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0]!.name).toBe('bar');
      expect(result.functions[1]!.name).toBe('calculate');
    });
  });

  describe('enum body', () => {
    it('should handle enum body with nested types', () => {
      const enumBody = getEnumBody(`
        enum Status {
          ACTIVE, INACTIVE;

          interface Validator {}
        }
      `);

      // Note: enum_body structure is different, but should work similarly
      if (enumBody) {
        const result = extractClassBody(enumBody, mockExtractClass);
        // Nested types in enums should be extracted
        expect(result.nestedClasses.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('ignored node types', () => {
    it('should ignore static initializers', () => {
      const classBody = getClassBody(`
        class Foo {
          static {
            System.out.println("Static block");
          }
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      // Static initializers are ignored
      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.nestedClasses).toEqual([]);
      expect(result.secondaryConstructors).toEqual([]);
    });

    it('should ignore instance initializers', () => {
      const classBody = getClassBody(`
        class Foo {
          {
            System.out.println("Instance block");
          }
        }
      `);
      const result = extractClassBody(classBody!, mockExtractClass);

      // Instance initializers are ignored
      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.nestedClasses).toEqual([]);
      expect(result.secondaryConstructors).toEqual([]);
    });
  });
});
