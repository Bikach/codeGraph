import { describe, it, expect, beforeEach } from 'vitest';
import { resolveMethodInType } from './resolve-method-in-type.js';
import type { SymbolTable, ResolutionContext, FunctionSymbol, TypeAliasSymbol } from '../types.js';
import type { ParsedFile } from '../../types.js';

describe('resolveMethodInType', () => {
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
    reexports: [],
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

  describe('direct method resolution', () => {
    it('should find method directly on type', () => {
      const classSymbol = {
        name: 'UserService',
        fqn: 'com.example.UserService',
        kind: 'class' as const,
        filePath: '/src/UserService.kt',
        location: createLocation('/src/UserService.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.UserService.findUser', {
        declaringTypeFqn: 'com.example.UserService',
      });

      table.byFqn.set('com.example.UserService', classSymbol);
      table.byFqn.set('com.example.UserService.findUser', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'UserService',
        'findUser'
      );

      expect(result).toBe('com.example.UserService.findUser');
    });

    it('should strip generics from type name', () => {
      const classSymbol = {
        name: 'Repository',
        fqn: 'com.example.Repository',
        kind: 'class' as const,
        filePath: '/src/Repository.kt',
        location: createLocation('/src/Repository.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.Repository.save', {
        declaringTypeFqn: 'com.example.Repository',
      });

      table.byFqn.set('com.example.Repository', classSymbol);
      table.byFqn.set('com.example.Repository.save', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'Repository<User>',
        'save'
      );

      expect(result).toBe('com.example.Repository.save');
    });
  });

  describe('type alias resolution', () => {
    it('should resolve method through type alias', () => {
      const aliasSymbol: TypeAliasSymbol = {
        name: 'UserRepo',
        fqn: 'com.example.UserRepo',
        kind: 'typealias',
        filePath: '/src/Aliases.kt',
        location: createLocation('/src/Aliases.kt'),
        packageName: 'com.example',
        aliasedType: 'UserRepository',
      };
      const classSymbol = {
        name: 'UserRepository',
        fqn: 'com.example.UserRepository',
        kind: 'class' as const,
        filePath: '/src/UserRepository.kt',
        location: createLocation('/src/UserRepository.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.UserRepository.findById', {
        declaringTypeFqn: 'com.example.UserRepository',
      });

      table.byFqn.set('com.example.UserRepo', aliasSymbol);
      table.byFqn.set('com.example.UserRepository', classSymbol);
      table.byFqn.set('com.example.UserRepository.findById', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'UserRepo',
        'findById'
      );

      expect(result).toBe('com.example.UserRepository.findById');
    });

    it('should handle type alias with generics', () => {
      const aliasSymbol: TypeAliasSymbol = {
        name: 'StringList',
        fqn: 'com.example.StringList',
        kind: 'typealias',
        filePath: '/src/Aliases.kt',
        location: createLocation('/src/Aliases.kt'),
        packageName: 'com.example',
        aliasedType: 'List<String>',
      };
      const classSymbol = {
        name: 'List',
        fqn: 'com.example.List',
        kind: 'class' as const,
        filePath: '/src/List.kt',
        location: createLocation('/src/List.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.List.add', {
        declaringTypeFqn: 'com.example.List',
      });

      table.byFqn.set('com.example.StringList', aliasSymbol);
      table.byFqn.set('com.example.List', classSymbol);
      table.byFqn.set('com.example.List.add', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'StringList',
        'add'
      );

      expect(result).toBe('com.example.List.add');
    });
  });

  describe('hierarchy fallback', () => {
    it('should fall back to hierarchy if method not on direct type', () => {
      const classSymbol = {
        name: 'UserService',
        fqn: 'com.example.UserService',
        kind: 'class' as const,
        filePath: '/src/UserService.kt',
        location: createLocation('/src/UserService.kt'),
        packageName: 'com.example',
      };
      const parentMethodSymbol = createFunctionSymbol('com.example.BaseService.init', {
        declaringTypeFqn: 'com.example.BaseService',
      });

      table.byFqn.set('com.example.UserService', classSymbol);
      table.byFqn.set('com.example.BaseService.init', parentMethodSymbol);
      table.typeHierarchy.set('com.example.UserService', ['com.example.BaseService']);

      const result = resolveMethodInType(
        table,
        createContext(),
        'UserService',
        'init'
      );

      expect(result).toBe('com.example.BaseService.init');
    });
  });

  describe('overload resolution', () => {
    it('should return single method without overload resolution', () => {
      const classSymbol = {
        name: 'Calculator',
        fqn: 'com.example.Calculator',
        kind: 'class' as const,
        filePath: '/src/Calculator.kt',
        location: createLocation('/src/Calculator.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.Calculator.add', {
        declaringTypeFqn: 'com.example.Calculator',
        parameterTypes: ['Int', 'Int'],
      });

      table.byFqn.set('com.example.Calculator', classSymbol);
      table.byFqn.set('com.example.Calculator.add', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'Calculator',
        'add'
      );

      expect(result).toBe('com.example.Calculator.add');
    });
  });

  describe('unknown type handling', () => {
    it('should use type name as FQN if type not found', () => {
      // When type is not in symbol table, use the type name directly
      const methodSymbol = createFunctionSymbol('ExternalClass.process', {
        declaringTypeFqn: 'ExternalClass',
      });

      table.byFqn.set('ExternalClass.process', methodSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'ExternalClass',
        'process'
      );

      expect(result).toBe('ExternalClass.process');
    });

    it('should return undefined if method not found', () => {
      const classSymbol = {
        name: 'UserService',
        fqn: 'com.example.UserService',
        kind: 'class' as const,
        filePath: '/src/UserService.kt',
        location: createLocation('/src/UserService.kt'),
        packageName: 'com.example',
      };

      table.byFqn.set('com.example.UserService', classSymbol);

      const result = resolveMethodInType(
        table,
        createContext(),
        'UserService',
        'nonExistentMethod'
      );

      expect(result).toBeUndefined();
    });
  });
});
