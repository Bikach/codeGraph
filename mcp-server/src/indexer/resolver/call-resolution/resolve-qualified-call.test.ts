import { describe, it, expect, beforeEach } from 'vitest';
import { resolveQualifiedCall } from './resolve-qualified-call.js';
import type { SymbolTable, FunctionSymbol } from '../types.js';

describe('resolveQualifiedCall', () => {
  let table: SymbolTable;

  const createLocation = (filePath = '/src/Test.kt') => ({
    filePath,
    startLine: 1,
    endLine: 10,
    startColumn: 0,
    endColumn: 0,
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

  const createCall = (name: string, overrides = {}) => ({
    name,
    location: createLocation(),
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

  describe('direct FQN lookup', () => {
    it('should resolve direct FQN match', () => {
      const methodSymbol = createFunctionSymbol('com.example.Utils.parse');
      table.byFqn.set('com.example.Utils.parse', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.Utils',
        'parse',
        createCall('parse')
      );

      expect(result).toBe('com.example.Utils.parse');
    });

    it('should resolve java stdlib style calls', () => {
      const methodSymbol = createFunctionSymbol('java.lang.System.currentTimeMillis');
      table.byFqn.set('java.lang.System.currentTimeMillis', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'java.lang.System',
        'currentTimeMillis',
        createCall('currentTimeMillis')
      );

      expect(result).toBe('java.lang.System.currentTimeMillis');
    });
  });

  describe('type-based resolution with overloads', () => {
    it('should find method on known type', () => {
      const typeSymbol = {
        name: 'StringUtils',
        fqn: 'com.example.StringUtils',
        kind: 'object' as const,
        filePath: '/src/StringUtils.kt',
        location: createLocation('/src/StringUtils.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.StringUtils.trim', {
        declaringTypeFqn: 'com.example.StringUtils',
      });

      table.byFqn.set('com.example.StringUtils', typeSymbol);
      table.byFqn.set('com.example.StringUtils.trim', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.StringUtils',
        'trim',
        createCall('trim')
      );

      expect(result).toBe('com.example.StringUtils.trim');
    });
  });

  describe('companion object resolution', () => {
    it('should resolve method on companion object', () => {
      const classSymbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      };
      const companionSymbol = {
        name: 'Companion',
        fqn: 'com.example.User.Companion',
        kind: 'object' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.User.Companion.create', {
        declaringTypeFqn: 'com.example.User.Companion',
      });

      table.byFqn.set('com.example.User', classSymbol);
      table.byFqn.set('com.example.User.Companion', companionSymbol);
      table.byFqn.set('com.example.User.Companion.create', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.User',
        'create',
        createCall('create')
      );

      expect(result).toBe('com.example.User.Companion.create');
    });
  });

  describe('nested package/object resolution', () => {
    it('should resolve method on object in package', () => {
      const objectSymbol = {
        name: 'Utils',
        fqn: 'com.example.Utils',
        kind: 'object' as const,
        filePath: '/src/Utils.kt',
        location: createLocation('/src/Utils.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.Utils.helper', {
        declaringTypeFqn: 'com.example.Utils',
      });

      table.byFqn.set('com.example.Utils', objectSymbol);
      table.byFqn.set('com.example.Utils.helper', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.Utils',
        'helper',
        createCall('helper')
      );

      expect(result).toBe('com.example.Utils.helper');
    });
  });

  describe('not found cases', () => {
    it('should return undefined for unknown qualified receiver', () => {
      const result = resolveQualifiedCall(
        table,
        'com.unknown.Type',
        'method',
        createCall('method')
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown method on known type', () => {
      const typeSymbol = {
        name: 'Known',
        fqn: 'com.example.Known',
        kind: 'class' as const,
        filePath: '/src/Known.kt',
        location: createLocation('/src/Known.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.Known', typeSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.Known',
        'unknownMethod',
        createCall('unknownMethod')
      );

      expect(result).toBeUndefined();
    });
  });

  describe('deeply nested qualifiers', () => {
    it('should handle deeply nested package paths', () => {
      const methodSymbol = createFunctionSymbol('com.example.deep.nested.Utils.process');
      table.byFqn.set('com.example.deep.nested.Utils.process', methodSymbol);

      const result = resolveQualifiedCall(
        table,
        'com.example.deep.nested.Utils',
        'process',
        createCall('process')
      );

      expect(result).toBe('com.example.deep.nested.Utils.process');
    });
  });
});
