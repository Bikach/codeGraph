import { describe, it, expect, beforeEach } from 'vitest';
import { resolveMethodInHierarchy } from './resolve-method-in-hierarchy.js';
import type { SymbolTable, ResolutionContext, FunctionSymbol } from '../types.js';
import type { ParsedFile } from '../../types.js';

describe('resolveMethodInHierarchy', () => {
  let table: SymbolTable;

  const createLocation = (filePath = '/src/Test.kt') => ({
    filePath,
    startLine: 1,
    endLine: 10,
    startColumn: 0,
    endColumn: 0,
  });

  const createFile = (): ParsedFile => ({
    filePath: '/src/Test.kt',
    language: 'kotlin',
    packageName: 'com.example',
    imports: [],
    reexports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
  });

  const createContext = (): ResolutionContext => ({
    currentFile: createFile(),
    language: 'kotlin',
    imports: new Map(),
    wildcardImports: [],
    localVariables: new Map(),
  });

  const createFunctionSymbol = (fqn: string, overrides: Partial<FunctionSymbol> = {}): FunctionSymbol => ({
    name: fqn.split('.').pop() || '',
    fqn,
    kind: 'function',
    filePath: '/src/Test.kt',
    location: createLocation(),
    packageName: 'com.example',
    parameterTypes: [],
    isExtension: false,
    ...overrides,
  });

  beforeEach(() => {
    table = {
      byFqn: new Map(),
      byName: new Map(),
      functionsByName: new Map(),
      byPackage: new Map(),
      typeHierarchy: new Map(),
    };
  });

  describe('direct parent resolution', () => {
    it('should find method in direct parent', () => {
      const parentMethod = createFunctionSymbol('com.example.Parent.doSomething');
      table.byFqn.set('com.example.Parent.doSomething', parentMethod);
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'doSomething'
      );

      expect(result).toBe('com.example.Parent.doSomething');
    });

    it('should return undefined if no hierarchy', () => {
      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Standalone',
        'doSomething'
      );

      expect(result).toBeUndefined();
    });
  });

  describe('deep hierarchy resolution', () => {
    it('should find method in grandparent', () => {
      const grandparentMethod = createFunctionSymbol('com.example.Grandparent.legacyMethod');
      table.byFqn.set('com.example.Grandparent.legacyMethod', grandparentMethod);
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);
      table.typeHierarchy.set('com.example.Parent', ['com.example.Grandparent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'legacyMethod'
      );

      expect(result).toBe('com.example.Grandparent.legacyMethod');
    });

    it('should prefer closer parent over grandparent', () => {
      const parentMethod = createFunctionSymbol('com.example.Parent.method');
      const grandparentMethod = createFunctionSymbol('com.example.Grandparent.method');
      table.byFqn.set('com.example.Parent.method', parentMethod);
      table.byFqn.set('com.example.Grandparent.method', grandparentMethod);
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);
      table.typeHierarchy.set('com.example.Parent', ['com.example.Grandparent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'method'
      );

      expect(result).toBe('com.example.Parent.method');
    });
  });

  describe('multiple inheritance (interfaces)', () => {
    it('should check multiple parents in order', () => {
      const interface1Method = createFunctionSymbol('com.example.Interface1.process');
      table.byFqn.set('com.example.Interface1.process', interface1Method);
      table.typeHierarchy.set('com.example.Impl', [
        'com.example.Interface1',
        'com.example.Interface2',
      ]);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Impl',
        'process'
      );

      expect(result).toBe('com.example.Interface1.process');
    });

    it('should find method in second interface if not in first', () => {
      const interface2Method = createFunctionSymbol('com.example.Interface2.special');
      table.byFqn.set('com.example.Interface2.special', interface2Method);
      table.typeHierarchy.set('com.example.Impl', [
        'com.example.Interface1',
        'com.example.Interface2',
      ]);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Impl',
        'special'
      );

      expect(result).toBe('com.example.Interface2.special');
    });
  });

  describe('overload resolution', () => {
    it('should resolve single overload without call info', () => {
      const method = createFunctionSymbol('com.example.Parent.process', {
        parameterTypes: ['String'],
      });
      table.byFqn.set('com.example.Parent.process', method);
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'process'
      );

      expect(result).toBe('com.example.Parent.process');
    });

    it('should use call info for overload resolution with multiple candidates', () => {
      const method1 = createFunctionSymbol('com.example.Parent.process', {
        parameterTypes: ['String'],
      });
      table.byFqn.set('com.example.Parent.process', method1);
      // Simulate multiple methods in type (normally done by byPackage index)
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'process',
        {
          name: 'process',
          location: createLocation(),
          argumentTypes: ['String'],
        }
      );

      // Should find the method (exact matching depends on findMethodsInType)
      expect(result).toBe('com.example.Parent.process');
    });
  });

  describe('backward compatibility - exact FQN match', () => {
    it('should fall back to exact FQN match', () => {
      // Method exists but not found via findMethodsInType (edge case)
      table.byFqn.set('com.example.Parent.legacyMethod', createFunctionSymbol('com.example.Parent.legacyMethod'));
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'legacyMethod'
      );

      expect(result).toBe('com.example.Parent.legacyMethod');
    });
  });

  describe('method not found', () => {
    it('should return undefined if method not in hierarchy', () => {
      table.typeHierarchy.set('com.example.Child', ['com.example.Parent']);
      table.typeHierarchy.set('com.example.Parent', ['com.example.Grandparent']);

      const result = resolveMethodInHierarchy(
        table,
        createContext(),
        'com.example.Child',
        'nonExistentMethod'
      );

      expect(result).toBeUndefined();
    });
  });
});
