import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCall } from './resolve-call.js';
import type { SymbolTable, ResolutionContext, FunctionSymbol } from '../types.js';
import type { ParsedFile, ParsedClass } from '../../types.js';

describe('resolveCall', () => {
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

  const createClass = (overrides: Partial<ParsedClass> = {}): ParsedClass => ({
    name: 'TestClass',
    kind: 'class',
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    location: createLocation(),
    functions: [],
    properties: [],
    nestedClasses: [],
    interfaces: [],
    annotations: [],
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

  describe('qualified call resolution', () => {
    it('should resolve qualified call', () => {
      const methodSymbol = createFunctionSymbol('com.example.Utils.parse');
      table.byFqn.set('com.example.Utils.parse', methodSymbol);

      const result = resolveCall(table, createContext(), {
        name: 'parse',
        receiver: 'com.example.Utils',
        location: createLocation(),
      });

      expect(result).toBe('com.example.Utils.parse');
    });
  });

  describe('constructor call resolution', () => {
    it('should resolve constructor call', () => {
      const classSymbol = {
        name: 'User',
        fqn: 'com.example.User',
        kind: 'class' as const,
        filePath: '/src/User.kt',
        location: createLocation('/src/User.kt'),
        packageName: 'com.example',
      };
      table.byFqn.set('com.example.User', classSymbol);

      const result = resolveCall(table, createContext(), {
        name: 'User',
        location: createLocation(),
      });

      expect(result).toBe('com.example.User.<init>');
    });
  });

  describe('receiver type resolution', () => {
    it('should resolve method via explicit receiver type', () => {
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

      const result = resolveCall(table, createContext(), {
        name: 'findUser',
        receiverType: 'UserService',
        location: createLocation(),
      });

      expect(result).toBe('com.example.UserService.findUser');
    });
  });

  describe('local variable receiver', () => {
    it('should resolve method via local variable type', () => {
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

      const context = createContext({
        localVariables: new Map([['repo', 'Repository']]),
      });

      const result = resolveCall(table, context, {
        name: 'save',
        receiver: 'repo',
        location: createLocation(),
      });

      expect(result).toBe('com.example.Repository.save');
    });
  });

  describe('class property receiver', () => {
    it('should resolve method via class property type', () => {
      const classSymbol = {
        name: 'Logger',
        fqn: 'com.example.Logger',
        kind: 'class' as const,
        filePath: '/src/Logger.kt',
        location: createLocation('/src/Logger.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.Logger.info', {
        declaringTypeFqn: 'com.example.Logger',
      });

      table.byFqn.set('com.example.Logger', classSymbol);
      table.byFqn.set('com.example.Logger.info', methodSymbol);

      const context = createContext({
        currentClass: createClass({
          properties: [
            {
              name: 'logger',
              type: 'Logger',
              visibility: 'private',
              isVal: true,
              location: createLocation(),
              annotations: [],
            },
          ],
        }),
      });

      const result = resolveCall(table, context, {
        name: 'info',
        receiver: 'logger',
        location: createLocation(),
      });

      expect(result).toBe('com.example.Logger.info');
    });
  });

  describe('current class method resolution', () => {
    it('should resolve method in current class', () => {
      const classSymbol = {
        name: 'MyClass',
        fqn: 'com.example.MyClass',
        kind: 'class' as const,
        filePath: '/src/MyClass.kt',
        location: createLocation('/src/MyClass.kt'),
        packageName: 'com.example',
      };
      const methodSymbol = createFunctionSymbol('com.example.MyClass.helperMethod', {
        declaringTypeFqn: 'com.example.MyClass',
      });

      table.byFqn.set('com.example.MyClass', classSymbol);
      table.byFqn.set('com.example.MyClass.helperMethod', methodSymbol);

      const context = createContext({
        currentClass: createClass({ name: 'MyClass' }),
      });

      const result = resolveCall(table, context, {
        name: 'helperMethod',
        location: createLocation(),
      });

      expect(result).toBe('com.example.MyClass.helperMethod');
    });
  });

  describe('import resolution', () => {
    it('should resolve from imports', () => {
      const context = createContext({
        imports: new Map([['processData', 'com.utils.processData']]),
      });

      const result = resolveCall(table, context, {
        name: 'processData',
        location: createLocation(),
      });

      expect(result).toBe('com.utils.processData');
    });
  });

  describe('same package resolution', () => {
    it('should resolve function in same package', () => {
      const funcSymbol = createFunctionSymbol('com.example.helperFunc');
      table.byFqn.set('com.example.helperFunc', funcSymbol);
      table.functionsByName.set('helperFunc', [funcSymbol]);

      const byPackage = table.byPackage.get('com.example') || [];
      byPackage.push(funcSymbol);
      table.byPackage.set('com.example', byPackage);

      const result = resolveCall(table, createContext(), {
        name: 'helperFunc',
        location: createLocation(),
      });

      expect(result).toBe('com.example.helperFunc');
    });
  });

  describe('stdlib resolution', () => {
    it('should resolve kotlin stdlib function', () => {
      const result = resolveCall(table, createContext({ language: 'kotlin' }), {
        name: 'println',
        location: createLocation(),
      });

      expect(result).toBe('kotlin.io.println');
    });
  });

  describe('not found', () => {
    it('should return undefined for unresolvable call', () => {
      const result = resolveCall(table, createContext(), {
        name: 'unknownFunction',
        location: createLocation(),
      });

      expect(result).toBeUndefined();
    });
  });
});
