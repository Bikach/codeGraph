import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractMethod } from './extract-function.js';
import { extractMethodSignature } from './extract-method.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract a method from a class.
 */
function parseMethod(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  const classBody = findChildByType(classNode, 'class_body');
  if (!classBody) throw new Error('No class body found');
  const methodNode = findChildByType(classBody, 'method_definition');
  if (!methodNode) throw new Error('No method found');
  return extractMethod(methodNode);
}

/**
 * Helper to parse and extract a method signature from an interface.
 */
function parseMethodSignature(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const interfaceNode = findChildByType(tree.rootNode, 'interface_declaration');
  if (!interfaceNode) throw new Error('No interface found');
  const interfaceBody = findChildByType(interfaceNode, 'interface_body');
  if (!interfaceBody) throw new Error('No interface body found');
  const methodNode = findChildByType(interfaceBody, 'method_signature');
  if (!methodNode) throw new Error('No method signature found');
  return extractMethodSignature(methodNode);
}

describe('extractMethod', () => {
  describe('basic methods', () => {
    it('should extract method name', () => {
      const method = parseMethod(`
        class Service {
          getData() {}
        }
      `);

      expect(method.name).toBe('getData');
    });

    it('should extract method without parameters', () => {
      const method = parseMethod(`
        class Service {
          start() {}
        }
      `);

      expect(method.parameters).toEqual([]);
    });

    it('should extract method with parameters', () => {
      const method = parseMethod(`
        class Service {
          process(data: string, count: number) {}
        }
      `);

      expect(method.parameters).toHaveLength(2);
      expect(method.parameters[0]!.name).toBe('data');
      expect(method.parameters[0]!.type).toBe('string');
      expect(method.parameters[1]!.name).toBe('count');
      expect(method.parameters[1]!.type).toBe('number');
    });
  });

  describe('method visibility', () => {
    it('should extract public method', () => {
      const method = parseMethod(`
        class Service {
          public getData() {}
        }
      `);

      expect(method.visibility).toBe('public');
    });

    it('should extract private method', () => {
      const method = parseMethod(`
        class Service {
          private getData() {}
        }
      `);

      expect(method.visibility).toBe('private');
    });

    it('should extract protected method', () => {
      const method = parseMethod(`
        class Service {
          protected getData() {}
        }
      `);

      expect(method.visibility).toBe('protected');
    });

    it('should default to public visibility', () => {
      const method = parseMethod(`
        class Service {
          getData() {}
        }
      `);

      expect(method.visibility).toBe('public');
    });
  });

  describe('async methods', () => {
    it('should detect async method', () => {
      const method = parseMethod(`
        class Service {
          async fetchData() {}
        }
      `);

      expect(method.isSuspend).toBe(true);
    });

    it('should not mark sync method as async', () => {
      const method = parseMethod(`
        class Service {
          getData() {}
        }
      `);

      expect(method.isSuspend).toBe(false);
    });
  });

  describe('return types', () => {
    it('should extract return type', () => {
      const method = parseMethod(`
        class Service {
          getData(): string { return ''; }
        }
      `);

      expect(method.returnType).toBe('string');
    });

    it('should extract Promise return type', () => {
      const method = parseMethod(`
        class Service {
          async fetchData(): Promise<Data> { return null; }
        }
      `);

      expect(method.returnType).toBe('Promise<Data>');
    });

    it('should return undefined when no return type', () => {
      const method = parseMethod(`
        class Service {
          getData() {}
        }
      `);

      expect(method.returnType).toBeUndefined();
    });
  });

  describe('generic methods', () => {
    it('should extract type parameters', () => {
      const method = parseMethod(`
        class Service {
          transform<T>(data: T): T { return data; }
        }
      `);

      expect(method.typeParameters).toHaveLength(1);
      expect(method.typeParameters![0]!.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const method = parseMethod(`
        class Service {
          map<K, V>(key: K, value: V): Map<K, V> { return null; }
        }
      `);

      expect(method.typeParameters).toHaveLength(2);
    });

    it('should extract type parameter with constraint', () => {
      const method = parseMethod(`
        class Service {
          process<T extends Entity>(data: T): T { return data; }
        }
      `);

      expect(method.typeParameters).toHaveLength(1);
      expect(method.typeParameters![0]!.bounds).toContain('Entity');
    });
  });

  describe('static methods', () => {
    it('should extract static method', () => {
      const method = parseMethod(`
        class Service {
          static getInstance() { return null; }
        }
      `);

      expect(method.name).toBe('getInstance');
    });
  });
});

describe('extractMethodSignature', () => {
  describe('interface method signatures', () => {
    it('should extract method signature name', () => {
      const method = parseMethodSignature(`
        interface Repository {
          find(id: string): Entity;
        }
      `);

      expect(method.name).toBe('find');
    });

    it('should extract method signature parameters', () => {
      const method = parseMethodSignature(`
        interface Repository {
          save(entity: Entity, options?: Options): void;
        }
      `);

      expect(method.parameters).toHaveLength(2);
      expect(method.parameters[0]!.name).toBe('entity');
      expect(method.parameters[1]!.name).toBe('options');
    });

    it('should extract method signature return type', () => {
      const method = parseMethodSignature(`
        interface Repository {
          findAll(): Entity[];
        }
      `);

      expect(method.returnType).toBe('Entity[]');
    });

    it('should extract generic method signature', () => {
      const method = parseMethodSignature(`
        interface Repository {
          transform<T>(data: T): T;
        }
      `);

      expect(method.typeParameters).toHaveLength(1);
      expect(method.typeParameters![0]!.name).toBe('T');
    });
  });
});
