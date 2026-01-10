import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { mapClassKind, isAbstractClass } from './map-class-kind.js';
import { findChildByType, findAllNodes } from '../ast-utils/index.js';

/**
 * Helper to get class kind from TypeScript source.
 */
function getClassKind(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode =
    findChildByType(tree.rootNode, 'class_declaration') ??
    findChildByType(tree.rootNode, 'abstract_class_declaration');
  if (!classNode) throw new Error('No class found');
  return mapClassKind(classNode);
}

/**
 * Helper to check if class is abstract from TypeScript source.
 */
function checkAbstract(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  // Find any class-like node
  const nodes = findAllNodes(tree.rootNode, (n) =>
    ['class_declaration', 'abstract_class_declaration'].includes(n.type)
  );
  if (nodes.length === 0) throw new Error('No class found');
  return isAbstractClass(nodes[0]!);
}

describe('mapClassKind', () => {
  it('should return class for regular class', () => {
    const kind = getClassKind(`class UserService {}`);
    expect(kind).toBe('class');
  });

  it('should return class for abstract class', () => {
    const kind = getClassKind(`abstract class BaseService {}`);
    expect(kind).toBe('class');
  });

  it('should return class for class with extends', () => {
    const kind = getClassKind(`class UserService extends BaseService {}`);
    expect(kind).toBe('class');
  });

  it('should return class for class with implements', () => {
    const kind = getClassKind(`class UserService implements Repository {}`);
    expect(kind).toBe('class');
  });

  it('should return class for class with generics', () => {
    const kind = getClassKind(`class Repository<T> {}`);
    expect(kind).toBe('class');
  });
});

describe('isAbstractClass', () => {
  it('should return true for abstract class', () => {
    const isAbstract = checkAbstract(`abstract class BaseService {}`);
    expect(isAbstract).toBe(true);
  });

  it('should return false for regular class', () => {
    const isAbstract = checkAbstract(`class UserService {}`);
    expect(isAbstract).toBe(false);
  });

  it('should return true for abstract class with members', () => {
    const isAbstract = checkAbstract(`
      abstract class BaseService {
        abstract getData(): string;
      }
    `);
    expect(isAbstract).toBe(true);
  });

  it('should return false for class extending abstract class', () => {
    // Note: The child class itself is not abstract
    const isAbstract = checkAbstract(`class UserService extends BaseService {}`);
    expect(isAbstract).toBe(false);
  });
});
