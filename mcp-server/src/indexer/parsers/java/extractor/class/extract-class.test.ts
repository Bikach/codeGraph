/**
 * Tests for extractClass
 */
import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractClass } from './extract-class.js';

/**
 * Helper to get a type declaration from Java source.
 */
function getTypeDeclaration(source: string) {
  const tree = parseJava(source);
  return (
    findChildByType(tree.rootNode, 'class_declaration') ??
    findChildByType(tree.rootNode, 'interface_declaration') ??
    findChildByType(tree.rootNode, 'enum_declaration') ??
    findChildByType(tree.rootNode, 'annotation_type_declaration') ??
    findChildByType(tree.rootNode, 'record_declaration')
  );
}

describe('extractClass', () => {
  describe('basic class properties', () => {
    it('should extract simple class name and kind', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.kind).toBe('class');
    });

    it('should extract public class visibility', () => {
      const node = getTypeDeclaration('public class Foo {}');
      const result = extractClass(node!);

      expect(result.visibility).toBe('public');
    });

    it('should extract package-private class visibility (default)', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.visibility).toBe('internal'); // package-private maps to internal
    });

    it('should extract abstract modifier', () => {
      const node = getTypeDeclaration('abstract class Foo {}');
      const result = extractClass(node!);

      expect(result.isAbstract).toBe(true);
    });

    it('should extract sealed modifier', () => {
      const node = getTypeDeclaration('sealed class Shape permits Circle {}');
      const result = extractClass(node!);

      // Sealed may not be supported by all tree-sitter-java versions
      if (result.isSealed !== undefined) {
        expect(result.isSealed).toBe(true);
      }
    });
  });

  describe('interface extraction', () => {
    it('should extract interface kind', () => {
      const node = getTypeDeclaration('interface Foo {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Foo');
      expect(result.kind).toBe('interface');
    });

    it('should extract public interface', () => {
      const node = getTypeDeclaration('public interface Foo {}');
      const result = extractClass(node!);

      expect(result.visibility).toBe('public');
      expect(result.kind).toBe('interface');
    });
  });

  describe('enum extraction', () => {
    it('should extract enum kind', () => {
      const node = getTypeDeclaration('enum Status { ACTIVE, INACTIVE }');
      const result = extractClass(node!);

      expect(result.name).toBe('Status');
      expect(result.kind).toBe('enum');
    });
  });

  describe('annotation extraction', () => {
    it('should extract annotation kind', () => {
      const node = getTypeDeclaration('@interface MyAnnotation {}');
      const result = extractClass(node!);

      expect(result.name).toBe('MyAnnotation');
      expect(result.kind).toBe('annotation');
    });
  });

  describe('type parameters', () => {
    it('should extract single type parameter', () => {
      const node = getTypeDeclaration('class Box<T> {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toHaveLength(1);
      expect(result.typeParameters![0]!.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = getTypeDeclaration('class Pair<K, V> {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toHaveLength(2);
      expect(result.typeParameters![0]!.name).toBe('K');
      expect(result.typeParameters![1]!.name).toBe('V');
    });

    it('should return undefined for class without generics', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.typeParameters).toBeUndefined();
    });
  });

  describe('inheritance', () => {
    it('should extract superclass', () => {
      const node = getTypeDeclaration('class Foo extends Bar {}');
      const result = extractClass(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual([]);
    });

    it('should extract implemented interfaces', () => {
      const node = getTypeDeclaration('class Foo implements Serializable, Cloneable {}');
      const result = extractClass(node!);

      expect(result.superClass).toBeUndefined();
      expect(result.interfaces).toEqual(['Serializable', 'Cloneable']);
    });

    it('should extract both superclass and interfaces', () => {
      const node = getTypeDeclaration('class Foo extends Bar implements Serializable {}');
      const result = extractClass(node!);

      expect(result.superClass).toBe('Bar');
      expect(result.interfaces).toEqual(['Serializable']);
    });
  });

  describe('annotations', () => {
    it('should extract single annotation', () => {
      const node = getTypeDeclaration('@Deprecated class Foo {}');
      const result = extractClass(node!);

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0]!.name).toBe('Deprecated');
    });

    it('should extract multiple annotations', () => {
      const node = getTypeDeclaration('@Deprecated @SuppressWarnings("all") class Foo {}');
      const result = extractClass(node!);

      expect(result.annotations).toHaveLength(2);
      expect(result.annotations.map((a) => a.name)).toContain('Deprecated');
      expect(result.annotations.map((a) => a.name)).toContain('SuppressWarnings');
    });
  });

  describe('nested classes', () => {
    it('should extract nested class', () => {
      const node = getTypeDeclaration(`
        class Outer {
          class Inner {}
        }
      `);
      const result = extractClass(node!);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Inner');
      expect(result.nestedClasses[0]!.kind).toBe('class');
    });

    it('should extract nested interface', () => {
      const node = getTypeDeclaration(`
        class Outer {
          interface Callback {}
        }
      `);
      const result = extractClass(node!);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Callback');
      expect(result.nestedClasses[0]!.kind).toBe('interface');
    });

    it('should extract nested enum', () => {
      const node = getTypeDeclaration(`
        class Outer {
          enum Status { ACTIVE }
        }
      `);
      const result = extractClass(node!);

      expect(result.nestedClasses).toHaveLength(1);
      expect(result.nestedClasses[0]!.name).toBe('Status');
      expect(result.nestedClasses[0]!.kind).toBe('enum');
    });

    it('should extract multiple nested types', () => {
      const node = getTypeDeclaration(`
        class Outer {
          class Inner1 {}
          interface Inner2 {}
          enum Inner3 { VALUE }
        }
      `);
      const result = extractClass(node!);

      expect(result.nestedClasses).toHaveLength(3);
    });
  });

  describe('location', () => {
    it('should include source location', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThanOrEqual(1);
      expect(result.location.startColumn).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Java-specific: no companion objects', () => {
    it('should have undefined companionObject', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.companionObject).toBeUndefined();
    });
  });

  describe('records (Java 16+)', () => {
    it('should extract record as class with isData: true', () => {
      const node = getTypeDeclaration('record Point(int x, int y) {}');
      const result = extractClass(node!);

      expect(result.name).toBe('Point');
      expect(result.kind).toBe('class');
      expect(result.isData).toBe(true);
    });

    it('should extract record components as properties', () => {
      const node = getTypeDeclaration('record Point(int x, int y) {}');
      const result = extractClass(node!);

      expect(result.properties).toHaveLength(2);
      expect(result.properties[0]!.name).toBe('x');
      expect(result.properties[0]!.type).toBe('int');
      expect(result.properties[0]!.isVal).toBe(true);
      expect(result.properties[1]!.name).toBe('y');
      expect(result.properties[1]!.type).toBe('int');
    });

    it('should extract record with generic types', () => {
      const node = getTypeDeclaration('record Container(List<String> items) {}');
      const result = extractClass(node!);

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.type).toBe('List<String>');
    });

    it('should extract record implementing interfaces', () => {
      const node = getTypeDeclaration('record Point(int x, int y) implements Serializable {}');
      const result = extractClass(node!);

      expect(result.interfaces).toContain('Serializable');
    });

    it('should combine record components with body members', () => {
      const node = getTypeDeclaration(`
        record Point(int x, int y) {
          public static final int ORIGIN = 0;
          public double distance() { return 0; }
        }
      `);
      const result = extractClass(node!);

      // Components first, then body members
      expect(result.properties.length).toBeGreaterThanOrEqual(2);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('distance');
    });
  });

  describe('sealed classes (Java 17+)', () => {
    it('should extract isSealed and permittedSubclasses', () => {
      const node = getTypeDeclaration('sealed class Shape permits Circle, Rectangle {}');
      const result = extractClass(node!);

      expect(result.isSealed).toBe(true);
      expect(result.permittedSubclasses).toEqual(['Circle', 'Rectangle']);
    });

    it('should extract single permitted subclass', () => {
      const node = getTypeDeclaration('sealed class Animal permits Dog {}');
      const result = extractClass(node!);

      expect(result.permittedSubclasses).toEqual(['Dog']);
    });

    it('should extract qualified type names in permits', () => {
      const node = getTypeDeclaration('sealed class Shape permits com.shapes.Circle {}');
      const result = extractClass(node!);

      expect(result.permittedSubclasses).toEqual(['com.shapes.Circle']);
    });

    it('should have undefined permittedSubclasses for non-sealed class', () => {
      const node = getTypeDeclaration('class Foo {}');
      const result = extractClass(node!);

      expect(result.permittedSubclasses).toBeUndefined();
    });
  });

  describe('class members extraction', () => {
    it('should extract properties', () => {
      const node = getTypeDeclaration(`
        class Foo {
          private int x;
          public String name;
        }
      `);
      const result = extractClass(node!);

      expect(result.properties).toHaveLength(2);
      expect(result.properties[0]!.name).toBe('x');
      expect(result.properties[0]!.visibility).toBe('private');
      expect(result.properties[1]!.name).toBe('name');
      expect(result.properties[1]!.visibility).toBe('public');
    });

    it('should extract functions', () => {
      const node = getTypeDeclaration(`
        class Foo {
          public void bar() {}
        }
      `);
      const result = extractClass(node!);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('bar');
      expect(result.functions[0]!.visibility).toBe('public');
    });

    it('should extract secondaryConstructors', () => {
      const node = getTypeDeclaration(`
        class Foo {
          public Foo() {}
          public Foo(int x) {}
        }
      `);
      const result = extractClass(node!);

      expect(result.secondaryConstructors).toHaveLength(2);
      expect(result.secondaryConstructors![0]!.visibility).toBe('public');
      expect(result.secondaryConstructors![1]!.parameters).toHaveLength(1);
    });
  });
});
