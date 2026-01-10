import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractClassProperty, extractPropertySignature } from './extract-class-property.js';
import type { SyntaxNode } from 'tree-sitter';

function findPublicFieldDefinition(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let field: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'public_field_definition' && !field) {
      field = node;
    }
  });
  return field;
}

function findPropertySignature(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let prop: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'property_signature' && !prop) {
      prop = node;
    }
  });
  return prop;
}

describe('extractClassProperty', () => {
  describe('basic extraction', () => {
    it('should extract property name', () => {
      const node = findPublicFieldDefinition('class Foo { name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.name).toBe('name');
    });

    it('should extract property type', () => {
      const node = findPublicFieldDefinition('class Foo { count: number }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.name).toBe('count');
      expect(prop.type).toBe('number');
    });

    it('should extract property initializer', () => {
      const node = findPublicFieldDefinition('class Foo { value = 42 }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.initializer).toBe('42');
    });

    it('should extract property with type and initializer', () => {
      const node = findPublicFieldDefinition('class Foo { message: string = "hello" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.name).toBe('message');
      expect(prop.type).toBe('string');
      expect(prop.initializer).toBe('"hello"');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const node = findPublicFieldDefinition('class Foo { name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findPublicFieldDefinition('class Foo { private name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const node = findPublicFieldDefinition('class Foo { protected name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.visibility).toBe('protected');
    });

    it('should detect private field (#fieldName) as private', () => {
      const node = findPublicFieldDefinition('class Foo { #secretValue = 42 }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.visibility).toBe('private');
      expect(prop.name).toBe('secretValue'); // # prefix removed
    });
  });

  describe('readonly', () => {
    it('should extract readonly property', () => {
      const node = findPublicFieldDefinition('class Foo { readonly name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.isVal).toBe(true);
    });

    it('should mark non-readonly as mutable', () => {
      const node = findPublicFieldDefinition('class Foo { name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.isVal).toBe(false);
    });
  });

  describe('static properties', () => {
    it('should extract static property', () => {
      const node = findPublicFieldDefinition('class Foo { static count = 0 }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.name).toBe('count');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findPublicFieldDefinition('class Foo { name = "test" }');
      expect(node).toBeDefined();
      const prop = extractClassProperty(node!);
      expect(prop.location).toBeDefined();
      expect(prop.location.startLine).toBeGreaterThan(0);
    });
  });
});

describe('extractPropertySignature', () => {
  describe('basic extraction', () => {
    it('should extract property name', () => {
      const node = findPropertySignature('interface Foo { name: string }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.name).toBe('name');
    });

    it('should extract property type', () => {
      const node = findPropertySignature('interface Foo { count: number }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.type).toBe('number');
    });

    it('should always be public', () => {
      const node = findPropertySignature('interface Foo { name: string }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.visibility).toBe('public');
    });
  });

  describe('readonly', () => {
    it('should extract readonly property', () => {
      const node = findPropertySignature('interface Foo { readonly id: number }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.isVal).toBe(true);
    });

    it('should mark non-readonly as mutable', () => {
      const node = findPropertySignature('interface Foo { name: string }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.isVal).toBe(false);
    });
  });

  describe('optional properties', () => {
    it('should handle optional property', () => {
      const node = findPropertySignature('interface Foo { name?: string }');
      expect(node).toBeDefined();
      const prop = extractPropertySignature(node!);
      expect(prop.name).toBe('name');
      expect(prop.type).toBe('string');
    });
  });
});
