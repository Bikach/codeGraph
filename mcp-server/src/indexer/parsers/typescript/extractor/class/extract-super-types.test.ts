import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractSuperTypes, extractInterfaceExtends } from './extract-super-types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract super types from a class.
 */
function parseClassSuperTypes(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  return extractSuperTypes(classNode);
}

/**
 * Helper to parse and extract extends from an interface.
 */
function parseInterfaceExtends(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const interfaceNode = findChildByType(tree.rootNode, 'interface_declaration');
  if (!interfaceNode) throw new Error('No interface found');
  return extractInterfaceExtends(interfaceNode);
}

describe('extractSuperTypes', () => {
  describe('extends clause', () => {
    it('should return undefined superClass when no extends', () => {
      const { superClass, interfaces } = parseClassSuperTypes(`class Service {}`);

      expect(superClass).toBeUndefined();
      expect(interfaces).toEqual([]);
    });

    it('should extract simple extends', () => {
      const { superClass } = parseClassSuperTypes(`class UserService extends BaseService {}`);

      expect(superClass).toBe('BaseService');
    });

    it('should extract extends with generics', () => {
      const { superClass } = parseClassSuperTypes(`class UserService extends BaseService<User> {}`);

      expect(superClass).toBe('BaseService<User>');
    });

    it('should extract extends with multiple generic parameters', () => {
      const { superClass } = parseClassSuperTypes(`class UserMap extends Map<string, User> {}`);

      expect(superClass).toBe('Map<string, User>');
    });
  });

  describe('implements clause', () => {
    it('should extract single implements', () => {
      const { interfaces } = parseClassSuperTypes(`class UserService implements Repository {}`);

      expect(interfaces).toEqual(['Repository']);
    });

    it('should extract multiple implements', () => {
      const { interfaces } = parseClassSuperTypes(
        `class UserService implements Repository, Cacheable, Serializable {}`
      );

      expect(interfaces).toEqual(['Repository', 'Cacheable', 'Serializable']);
    });

    it('should extract implements with generics', () => {
      const { interfaces } = parseClassSuperTypes(`class UserService implements Repository<User> {}`);

      expect(interfaces).toContain('Repository<User>');
    });

    it('should extract multiple implements with generics', () => {
      const { interfaces } = parseClassSuperTypes(
        `class UserService implements Repository<User>, Comparable<UserService> {}`
      );

      expect(interfaces).toContain('Repository<User>');
      expect(interfaces).toContain('Comparable<UserService>');
    });
  });

  describe('extends and implements combined', () => {
    it('should extract both extends and implements', () => {
      const { superClass, interfaces } = parseClassSuperTypes(
        `class UserService extends BaseService implements Repository {}`
      );

      expect(superClass).toBe('BaseService');
      expect(interfaces).toEqual(['Repository']);
    });

    it('should extract extends and multiple implements', () => {
      const { superClass, interfaces } = parseClassSuperTypes(
        `class UserService extends BaseService implements Repository, Cacheable {}`
      );

      expect(superClass).toBe('BaseService');
      expect(interfaces).toEqual(['Repository', 'Cacheable']);
    });

    it('should extract extends and implements with generics', () => {
      const { superClass, interfaces } = parseClassSuperTypes(
        `class UserService extends BaseService<User> implements Repository<User>, Comparable<UserService> {}`
      );

      expect(superClass).toBe('BaseService<User>');
      expect(interfaces).toContain('Repository<User>');
      expect(interfaces).toContain('Comparable<UserService>');
    });
  });
});

describe('extractInterfaceExtends', () => {
  it('should return empty array when no extends', () => {
    const interfaces = parseInterfaceExtends(`interface Repository {}`);

    expect(interfaces).toEqual([]);
  });

  it('should extract single extends', () => {
    const interfaces = parseInterfaceExtends(`interface UserRepository extends Repository {}`);

    expect(interfaces).toEqual(['Repository']);
  });

  it('should extract multiple extends', () => {
    const interfaces = parseInterfaceExtends(
      `interface UserRepository extends Repository, Cacheable, Serializable {}`
    );

    expect(interfaces).toEqual(['Repository', 'Cacheable', 'Serializable']);
  });

  it('should extract extends with generics', () => {
    const interfaces = parseInterfaceExtends(`interface UserRepository extends Repository<User> {}`);

    expect(interfaces).toContain('Repository<User>');
  });

  it('should extract multiple extends with generics', () => {
    const interfaces = parseInterfaceExtends(
      `interface UserRepository extends Repository<User>, Comparable<UserRepository> {}`
    );

    expect(interfaces).toContain('Repository<User>');
    expect(interfaces).toContain('Comparable<UserRepository>');
  });
});
