import { describe, it, expect, beforeEach } from 'vitest';
import { resolveSymbolByName } from './resolve-symbol-by-name.js';
import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedFile } from '../../types.js';

describe('resolveSymbolByName', () => {
  let table: SymbolTable;

  const createLocation = (filePath = '/src/Test.kt') => ({
    filePath,
    startLine: 1,
    endLine: 10,
    startColumn: 0,
    endColumn: 0,
  });

  const createFile = (overrides: Partial<ParsedFile> = {}): ParsedFile => ({
    filePath: '/src/Test.kt',
    language: 'kotlin',
    packageName: 'com.example',
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    ...overrides,
  });

  const createContext = (overrides: Partial<ResolutionContext> = {}): ResolutionContext => ({
    currentFile: createFile(),
    language: 'kotlin',
    imports: new Map(),
    wildcardImports: [],
    localVariables: new Map(),
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

  describe('import resolution', () => {
    it('should resolve from explicit imports', () => {
      const symbol = {
        name: 'User',
        fqn: 'com.other.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.other',
      };
      table.byFqn.set('com.other.User', symbol);

      const context = createContext({
        imports: new Map([['User', 'com.other.User']]),
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(symbol);
    });

    it('should return undefined if import FQN not in table', () => {
      const context = createContext({
        imports: new Map([['User', 'com.other.User']]),
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBeUndefined();
    });
  });

  describe('same package resolution', () => {
    it('should resolve from same package', () => {
      const symbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.User', symbol);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(symbol);
    });

    it('should not check same package if package is empty', () => {
      const symbol = {
        name: 'User',
        fqn: 'User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: '',
      };
      table.byFqn.set('User', symbol);
      table.byName.set('User', [symbol]);

      const context = createContext({
        currentFile: createFile({ packageName: '' }),
      });

      // Should find via simple name lookup instead
      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(symbol);
    });
  });

  describe('wildcard import resolution', () => {
    it('should resolve from wildcard imports', () => {
      const symbol = {
        name: 'User',
        fqn: 'com.other.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.other',
      };
      table.byFqn.set('com.other.User', symbol);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
        wildcardImports: ['com.other'],
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(symbol);
    });

    it('should check multiple wildcard imports in order', () => {
      const symbol1 = {
        name: 'User',
        fqn: 'com.first.User',
        kind: 'class' as const,
        filePath: '/src/User1.kt',
        location: createLocation('/src/User1.kt'),
        packageName: 'com.first',
      };
      const symbol2 = {
        name: 'User',
        fqn: 'com.second.User',
        kind: 'class' as const,
        filePath: '/src/User2.kt',
        location: createLocation('/src/User2.kt'),
        packageName: 'com.second',
      };
      table.byFqn.set('com.first.User', symbol1);
      table.byFqn.set('com.second.User', symbol2);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
        wildcardImports: ['com.first', 'com.second'],
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(symbol1); // First match wins
    });
  });

  describe('simple name resolution', () => {
    it('should resolve unique simple name', () => {
      const symbol = {
        name: 'UniqueClass',
        fqn: 'com.other.UniqueClass',
        kind: 'class' as const,
        filePath: '/src/UniqueClass.kt',
        location: createLocation('/src/UniqueClass.kt'),
        packageName: 'com.other',
      };
      table.byFqn.set('com.other.UniqueClass', symbol);
      table.byName.set('UniqueClass', [symbol]);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
      });

      const result = resolveSymbolByName(table, context, 'UniqueClass');
      expect(result).toBe(symbol);
    });

    it('should not resolve ambiguous simple name', () => {
      const symbol1 = {
        name: 'User',
        fqn: 'com.a.User',
        kind: 'class' as const,
        filePath: '/src/User1.kt',
        location: createLocation('/src/User1.kt'),
        packageName: 'com.a',
      };
      const symbol2 = {
        name: 'User',
        fqn: 'com.b.User',
        kind: 'class' as const,
        filePath: '/src/User2.kt',
        location: createLocation('/src/User2.kt'),
        packageName: 'com.b',
      };
      table.byName.set('User', [symbol1, symbol2]);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBeUndefined();
    });
  });

  describe('stdlib resolution', () => {
    it('should resolve kotlin stdlib classes', () => {
      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
        language: 'kotlin',
      });

      const result = resolveSymbolByName(table, context, 'String');
      expect(result).toBeDefined();
      expect(result?.fqn).toBe('kotlin.String');
    });

    it('should resolve java stdlib classes', () => {
      const context = createContext({
        currentFile: createFile({ language: 'java', packageName: 'com.example' }),
        language: 'java',
      });

      const result = resolveSymbolByName(table, context, 'Object');
      expect(result).toBeDefined();
      expect(result?.fqn).toBe('java.lang.Object');
    });
  });

  describe('priority order', () => {
    it('should prefer imports over same package', () => {
      const importedSymbol = {
        name: 'User',
        fqn: 'com.imported.User',
        kind: 'class' as const,
        filePath: '/src/ImportedUser.kt',
        location: createLocation('/src/ImportedUser.kt'),
        packageName: 'com.imported',
      };
      const samePackageSymbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/LocalUser.kt',
        location: createLocation('/src/LocalUser.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.imported.User', importedSymbol);
      table.byFqn.set('com.example.User', samePackageSymbol);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
        imports: new Map([['User', 'com.imported.User']]),
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(importedSymbol);
    });

    it('should prefer same package over wildcard imports', () => {
      const samePackageSymbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/LocalUser.kt',
        location: createLocation('/src/LocalUser.kt'),
        packageName: 'com.example',
      };
      const wildcardSymbol = {
        name: 'User',
        fqn: 'com.other.User',
        kind: 'class' as const,
        filePath: '/src/OtherUser.kt',
        location: createLocation('/src/OtherUser.kt'),
        packageName: 'com.other',
      };
      table.byFqn.set('com.example.User', samePackageSymbol);
      table.byFqn.set('com.other.User', wildcardSymbol);

      const context = createContext({
        currentFile: createFile({ packageName: 'com.example' }),
        wildcardImports: ['com.other'],
      });

      const result = resolveSymbolByName(table, context, 'User');
      expect(result).toBe(samePackageSymbol);
    });
  });
});
