import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractInterface } from './extract-interface.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract an interface from TypeScript source.
 */
function parseInterface(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const interfaceNode = findChildByType(tree.rootNode, 'interface_declaration');
  if (!interfaceNode) throw new Error('No interface found');
  return extractInterface(interfaceNode);
}

describe('extractInterface', () => {
  describe('basic interface', () => {
    it('should extract interface name', () => {
      const iface = parseInterface(`interface Repository {}`);

      expect(iface.name).toBe('Repository');
      expect(iface.kind).toBe('interface');
    });

    it('should mark interface as abstract', () => {
      const iface = parseInterface(`interface Service {}`);

      expect(iface.isAbstract).toBe(true);
    });

    it('should extract empty interface', () => {
      const iface = parseInterface(`interface Empty {}`);

      expect(iface.properties).toEqual([]);
      expect(iface.functions).toEqual([]);
    });
  });

  describe('interface extends', () => {
    it('should extract single extends', () => {
      const iface = parseInterface(`interface UserRepository extends Repository {}`);

      expect(iface.interfaces).toEqual(['Repository']);
    });

    it('should extract multiple extends', () => {
      const iface = parseInterface(`interface UserRepository extends Repository, Cacheable, Serializable {}`);

      expect(iface.interfaces).toEqual(['Repository', 'Cacheable', 'Serializable']);
    });

    it('should extract extends with generics', () => {
      const iface = parseInterface(`interface UserRepository extends Repository<User> {}`);

      expect(iface.interfaces).toContain('Repository<User>');
    });
  });

  describe('interface properties', () => {
    it('should extract property signature', () => {
      const iface = parseInterface(`
        interface Config {
          timeout: number;
        }
      `);

      expect(iface.properties).toHaveLength(1);
      expect(iface.properties[0]!.name).toBe('timeout');
      expect(iface.properties[0]!.type).toBe('number');
    });

    it('should extract optional property', () => {
      const iface = parseInterface(`
        interface Config {
          retries?: number;
        }
      `);

      expect(iface.properties).toHaveLength(1);
      expect(iface.properties[0]!.name).toBe('retries');
    });

    it('should extract readonly property', () => {
      const iface = parseInterface(`
        interface Config {
          readonly version: string;
        }
      `);

      expect(iface.properties).toHaveLength(1);
      expect(iface.properties[0]!.name).toBe('version');
    });

    it('should extract multiple properties', () => {
      const iface = parseInterface(`
        interface User {
          id: number;
          name: string;
          email?: string;
        }
      `);

      expect(iface.properties).toHaveLength(3);
      expect(iface.properties.map((p) => p.name)).toEqual(['id', 'name', 'email']);
    });
  });

  describe('interface methods', () => {
    it('should extract method signature', () => {
      const iface = parseInterface(`
        interface Repository {
          find(id: string): Entity | null;
        }
      `);

      expect(iface.functions).toHaveLength(1);
      expect(iface.functions[0]!.name).toBe('find');
    });

    it('should extract method with parameters', () => {
      const iface = parseInterface(`
        interface Service {
          process(data: string, options: Options): Result;
        }
      `);

      expect(iface.functions).toHaveLength(1);
      expect(iface.functions[0]!.parameters).toHaveLength(2);
      expect(iface.functions[0]!.parameters[0]!.name).toBe('data');
      expect(iface.functions[0]!.parameters[1]!.name).toBe('options');
    });

    it('should extract method return type', () => {
      const iface = parseInterface(`
        interface Service {
          getData(): Promise<Data>;
        }
      `);

      expect(iface.functions[0]!.returnType).toBe('Promise<Data>');
    });

    it('should extract multiple methods', () => {
      const iface = parseInterface(`
        interface Repository {
          find(id: string): Entity | null;
          save(entity: Entity): void;
          delete(id: string): boolean;
        }
      `);

      expect(iface.functions).toHaveLength(3);
      expect(iface.functions.map((f) => f.name)).toEqual(['find', 'save', 'delete']);
    });
  });

  describe('interface generics', () => {
    it('should extract single type parameter', () => {
      const iface = parseInterface(`interface Repository<T> {}`);

      expect(iface.typeParameters).toHaveLength(1);
      expect(iface.typeParameters![0]!.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const iface = parseInterface(`interface Map<K, V> {}`);

      expect(iface.typeParameters).toHaveLength(2);
      expect(iface.typeParameters![0]!.name).toBe('K');
      expect(iface.typeParameters![1]!.name).toBe('V');
    });

    it('should extract type parameter with constraint', () => {
      const iface = parseInterface(`interface Repository<T extends Entity> {}`);

      expect(iface.typeParameters).toHaveLength(1);
      expect(iface.typeParameters![0]!.name).toBe('T');
      expect(iface.typeParameters![0]!.bounds).toContain('Entity');
    });

    it('should extract type parameter with default', () => {
      const iface = parseInterface(`interface Container<T = any> {}`);

      expect(iface.typeParameters).toHaveLength(1);
      expect(iface.typeParameters![0]!.name).toBe('T');
    });
  });

  describe('complex interfaces', () => {
    it('should extract interface with index signature', () => {
      const iface = parseInterface(`
        interface Dictionary {
          [key: string]: string;
        }
      `);

      // Index signatures are not extracted as properties
      expect(iface.name).toBe('Dictionary');
    });

    it('should extract interface with call signature', () => {
      const iface = parseInterface(`
        interface Formatter {
          (value: string): string;
        }
      `);

      expect(iface.name).toBe('Formatter');
    });

    it('should extract interface with mixed members', () => {
      const iface = parseInterface(`
        interface Service<T> extends BaseService {
          readonly name: string;
          timeout?: number;
          process(data: T): Promise<Result>;
          validate(input: string): boolean;
        }
      `);

      expect(iface.typeParameters).toHaveLength(1);
      expect(iface.interfaces).toContain('BaseService');
      expect(iface.properties).toHaveLength(2);
      expect(iface.functions).toHaveLength(2);
    });
  });
});
