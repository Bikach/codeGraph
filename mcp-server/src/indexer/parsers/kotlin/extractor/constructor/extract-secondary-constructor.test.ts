import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractSecondaryConstructor } from './extract-secondary-constructor.js';

function findSecondaryConstructor(source: string) {
  const tree = parseKotlin(source);
  let ctor: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'secondary_constructor' && !ctor) {
      ctor = node;
    }
  });
  return ctor;
}

describe('extractSecondaryConstructor', () => {
  describe('parameters', () => {
    it('should extract constructor parameters', () => {
      const node = findSecondaryConstructor(`
        class User {
          constructor(name: String, age: Int)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.parameters).toHaveLength(2);
      expect(ctor.parameters[0]?.name).toBe('name');
      expect(ctor.parameters[1]?.name).toBe('age');
    });

    it('should extract parameter types', () => {
      const node = findSecondaryConstructor(`
        class User {
          constructor(id: Long)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.parameters[0]?.type).toBe('Long');
    });

    it('should handle no parameters', () => {
      const node = findSecondaryConstructor(`
        class User(val name: String) {
          constructor() : this("default")
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.parameters).toHaveLength(0);
    });
  });

  describe('delegation', () => {
    it('should detect delegation to this()', () => {
      const node = findSecondaryConstructor(`
        class User(val name: String) {
          constructor(id: Int) : this("User#" + id)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.delegatesTo).toBe('this');
    });

    it('should detect delegation to super()', () => {
      const node = findSecondaryConstructor(`
        class Admin : User {
          constructor(name: String) : super(name)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.delegatesTo).toBe('super');
    });
  });

  describe('visibility', () => {
    it('should extract private visibility', () => {
      const node = findSecondaryConstructor(`
        class User {
          private constructor(secret: String)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.visibility).toBe('private');
    });

    it('should default to public visibility', () => {
      const node = findSecondaryConstructor(`
        class User {
          constructor(name: String)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.visibility).toBe('public');
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findSecondaryConstructor(`
        class User {
          constructor(name: String)
        }
      `);
      const ctor = extractSecondaryConstructor(node!);
      expect(ctor.location).toBeDefined();
    });
  });
});
