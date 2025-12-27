import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTypeName } from './resolve-type-name.js';
import type { SymbolTable } from '../types.js';

describe('resolveTypeName', () => {
  let table: SymbolTable;

  const createLocation = (filePath = '/src/Test.kt') => ({
    filePath,
    startLine: 1,
    endLine: 10,
    startColumn: 0,
    endColumn: 0,
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

  describe('FQN resolution', () => {
    it('should return the type name if already an FQN', () => {
      table.byFqn.set('com.example.User', {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class',
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, 'com.example.User', 'com.other');
      expect(result).toBe('com.example.User');
    });

    it('should resolve FQN with generics stripped', () => {
      table.byFqn.set('com.example.List', {
        name: 'List',
        fqn: 'com.example.List',
        kind: 'class',
        filePath: '/src/List.kt',
        location: createLocation('/src/List.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, 'com.example.List<String>', 'com.other');
      expect(result).toBe('com.example.List');
    });
  });

  describe('same package resolution', () => {
    it('should resolve type in the same package', () => {
      table.byFqn.set('com.example.User', {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class',
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, 'User', 'com.example');
      expect(result).toBe('com.example.User');
    });

    it('should resolve type with generics in the same package', () => {
      table.byFqn.set('com.example.Repository', {
        name: 'Repository',
        fqn: 'com.example.Repository',
        kind: 'interface',
        filePath: '/src/Repository.kt',
        location: createLocation('/src/Repository.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, 'Repository<User>', 'com.example');
      expect(result).toBe('com.example.Repository');
    });

    it('should resolve type without package when current package is empty', () => {
      table.byFqn.set('User', {
        name: 'User',
        fqn: 'User',
        kind: 'class',
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: '',
      });

      const result = resolveTypeName(table, 'User', '');
      expect(result).toBe('User');
    });
  });

  describe('simple name resolution', () => {
    it('should resolve unique simple name', () => {
      const symbol = {
        name: 'User',
        fqn: 'com.other.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.other',
      };
      table.byFqn.set('com.other.User', symbol);
      table.byName.set('User', [symbol]);

      const result = resolveTypeName(table, 'User', 'com.example');
      expect(result).toBe('com.other.User');
    });

    it('should return undefined for ambiguous simple name', () => {
      const symbol1 = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/User1.kt',
        location: createLocation('/src/User1.kt'),
        packageName: 'com.example',
      };
      const symbol2 = {
        name: 'User',
        fqn: 'com.other.User',
        kind: 'class' as const,
        filePath: '/src/User2.kt',
        location: createLocation('/src/User2.kt'),
        packageName: 'com.other',
      };
      table.byName.set('User', [symbol1, symbol2]);

      const result = resolveTypeName(table, 'User', 'com.different');
      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should return undefined for unknown type', () => {
      const result = resolveTypeName(table, 'Unknown', 'com.example');
      expect(result).toBeUndefined();
    });

    it('should handle empty type name', () => {
      const result = resolveTypeName(table, '', 'com.example');
      expect(result).toBeUndefined();
    });

    it('should handle type with complex generics', () => {
      table.byFqn.set('com.example.Map', {
        name: 'Map',
        fqn: 'com.example.Map',
        kind: 'class',
        filePath: '/src/Map.kt',
        location: createLocation('/src/Map.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, 'Map<String, List<User>>', 'com.example');
      expect(result).toBe('com.example.Map');
    });

    it('should handle type with spaces around generics', () => {
      table.byFqn.set('com.example.List', {
        name: 'List',
        fqn: 'com.example.List',
        kind: 'class',
        filePath: '/src/List.kt',
        location: createLocation('/src/List.kt'),
        packageName: 'com.example',
      });

      const result = resolveTypeName(table, '  List < String > ', 'com.example');
      expect(result).toBe('com.example.List');
    });
  });
});
