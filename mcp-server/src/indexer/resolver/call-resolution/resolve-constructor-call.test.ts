import { describe, it, expect, beforeEach } from 'vitest';
import { resolveConstructorCall } from './resolve-constructor-call.js';
import type { SymbolTable, ResolutionContext } from '../types.js';
import type { ParsedFile } from '../../types.js';

describe('resolveConstructorCall', () => {
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

  const createCall = (name: string) => ({
    name,
    location: createLocation(),
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

  describe('class constructor resolution', () => {
    it('should resolve constructor call for class', () => {
      const classSymbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.User', classSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'User',
        createCall('User')
      );

      expect(result).toBe('com.example.User.<init>');
    });

    it('should resolve constructor call for enum', () => {
      const enumSymbol = {
        name: 'Status',
        fqn: 'com.example.Status',
        kind: 'enum' as const,
        filePath: '/src/Status.kt',
        location: createLocation('/src/Status.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.Status', enumSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'Status',
        createCall('Status')
      );

      expect(result).toBe('com.example.Status.<init>');
    });

    it('should resolve constructor call for annotation', () => {
      const annotationSymbol = {
        name: 'Deprecated',
        fqn: 'com.example.Deprecated',
        kind: 'annotation' as const,
        filePath: '/src/Deprecated.kt',
        location: createLocation('/src/Deprecated.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.Deprecated', annotationSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'Deprecated',
        createCall('Deprecated')
      );

      expect(result).toBe('com.example.Deprecated.<init>');
    });
  });

  describe('lowercase names (not constructors)', () => {
    it('should return undefined for lowercase name', () => {
      const result = resolveConstructorCall(
        table,
        createContext(),
        'process',
        createCall('process')
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for function-like names', () => {
      const result = resolveConstructorCall(
        table,
        createContext(),
        'createUser',
        createCall('createUser')
      );

      expect(result).toBeUndefined();
    });
  });

  describe('non-class types', () => {
    it('should return undefined for interface', () => {
      const interfaceSymbol = {
        name: 'Repository',
        fqn: 'com.example.Repository',
        kind: 'interface' as const,
        filePath: '/src/Repository.kt',
        location: createLocation('/src/Repository.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.Repository', interfaceSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'Repository',
        createCall('Repository')
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for object', () => {
      const objectSymbol = {
        name: 'Singleton',
        fqn: 'com.example.Singleton',
        kind: 'object' as const,
        filePath: '/src/Singleton.kt',
        location: createLocation('/src/Singleton.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.Singleton', objectSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'Singleton',
        createCall('Singleton')
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for function symbol', () => {
      const funcSymbol = {
        name: 'Process',
        fqn: 'com.example.Process',
        kind: 'function' as const,
        filePath: '/src/Process.kt',
        location: createLocation('/src/Process.kt'),
        packageName: 'com.example',
        parameterTypes: [],
      };
      table.byFqn.set('com.example.Process', funcSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'Process',
        createCall('Process')
      );

      expect(result).toBeUndefined();
    });
  });

  describe('symbol not found', () => {
    it('should return undefined for unknown class name', () => {
      const result = resolveConstructorCall(
        table,
        createContext(),
        'UnknownClass',
        createCall('UnknownClass')
      );

      expect(result).toBeUndefined();
    });
  });

  describe('import resolution', () => {
    it('should resolve constructor through imports', () => {
      const classSymbol = {
        name: 'RemoteUser',
        fqn: 'com.remote.RemoteUser',
        kind: 'class' as const,
        filePath: '/src/RemoteUser.kt',
        location: createLocation('/src/RemoteUser.kt'),
        packageName: 'com.remote',
      };
      table.byFqn.set('com.remote.RemoteUser', classSymbol);

      const context = createContext({
        imports: new Map([['RemoteUser', 'com.remote.RemoteUser']]),
      });

      const result = resolveConstructorCall(
        table,
        context,
        'RemoteUser',
        createCall('RemoteUser')
      );

      expect(result).toBe('com.remote.RemoteUser.<init>');
    });
  });

  describe('edge cases', () => {
    it('should handle empty name', () => {
      const result = resolveConstructorCall(
        table,
        createContext(),
        '',
        createCall('')
      );

      expect(result).toBeUndefined();
    });

    it('should handle single uppercase letter', () => {
      const classSymbol = {
        name: 'A',
        fqn: 'com.example.A',
        kind: 'class' as const,
        filePath: '/src/A.kt',
        location: createLocation('/src/A.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.A', classSymbol);

      const result = resolveConstructorCall(
        table,
        createContext(),
        'A',
        createCall('A')
      );

      expect(result).toBe('com.example.A.<init>');
    });

    it('should handle numeric-looking names', () => {
      // Names like "123" won't match uppercase check
      const result = resolveConstructorCall(
        table,
        createContext(),
        '123',
        createCall('123')
      );

      expect(result).toBeUndefined();
    });
  });
});
