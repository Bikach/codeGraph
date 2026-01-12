import { describe, it, expect, beforeEach } from 'vitest';
import { resolveExtensionFunction } from './resolve-extension-function.js';
import type { SymbolTable, ResolutionContext, FunctionSymbol } from '../types.js';
import type { ParsedFile, ParsedClass } from '../../types.js';

describe('resolveExtensionFunction', () => {
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

  const createExtensionFunction = (fqn: string, receiverType: string, overrides: Partial<FunctionSymbol> = {}): FunctionSymbol => ({
    name: fqn.split('.').pop() || '',
    fqn,
    kind: 'function',
    filePath: '/src/Extensions.kt',
    location: createLocation('/src/Extensions.kt'),
    packageName: 'com.example',
    parameterTypes: [],
    isExtension: true,
    receiverType,
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

  describe('basic extension function resolution', () => {
    it('should find extension function by name', () => {
      const extFunc = createExtensionFunction('com.example.formatString', 'String');
      table.functionsByName.set('formatString', [extFunc]);

      const result = resolveExtensionFunction(
        table,
        createContext(),
        'myString',
        'formatString'
      );

      expect(result).toBe('com.example.formatString');
    });

    it('should return undefined if no extension functions exist', () => {
      const regularFunc: FunctionSymbol = {
        name: 'process',
        fqn: 'com.example.process',
        kind: 'function',
        filePath: '/src/Test.kt',
        location: createLocation(),
        packageName: 'com.example',
        parameterTypes: [],
        isExtension: false,
      };
      table.functionsByName.set('process', [regularFunc]);

      const result = resolveExtensionFunction(
        table,
        createContext(),
        'receiver',
        'process'
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined if function name not found', () => {
      const result = resolveExtensionFunction(
        table,
        createContext(),
        'receiver',
        'nonExistent'
      );

      expect(result).toBeUndefined();
    });
  });

  describe('receiver type matching', () => {
    it('should match extension by local variable type', () => {
      const intExt = createExtensionFunction('com.example.formatInt', 'Int', { name: 'format' });
      const stringExtFormat = createExtensionFunction('com.example.formatStringAlt', 'String', { name: 'format' });

      table.functionsByName.set('format', [intExt, stringExtFormat]);

      const context = createContext({
        localVariables: new Map([['myVar', 'String']]),
      });

      const result = resolveExtensionFunction(
        table,
        context,
        'myVar',
        'format'
      );

      expect(result).toBe('com.example.formatStringAlt');
    });

    it('should match extension by class property type', () => {
      const listExt = createExtensionFunction('com.example.listUtils', 'List');
      table.functionsByName.set('listUtils', [listExt]);

      const context = createContext({
        currentClass: createClass({
          properties: [
            {
              name: 'items',
              type: 'List<String>',
              visibility: 'private',
              isVal: true,
              location: createLocation(),
              annotations: [],
            },
          ],
        }),
      });

      const result = resolveExtensionFunction(
        table,
        context,
        'items',
        'listUtils'
      );

      expect(result).toBe('com.example.listUtils');
    });

    it('should strip generics when matching receiver type', () => {
      const mapExt = createExtensionFunction('com.example.mapHelper', 'Map');
      table.functionsByName.set('mapHelper', [mapExt]);

      const context = createContext({
        localVariables: new Map([['data', 'Map<String, Int>']]),
      });

      const result = resolveExtensionFunction(
        table,
        context,
        'data',
        'mapHelper'
      );

      expect(result).toBe('com.example.mapHelper');
    });
  });

  describe('type compatibility fallback', () => {
    it('should use type compatibility when no exact match', () => {
      const numberExt = createExtensionFunction('com.example.numberFormat', 'Number');
      table.functionsByName.set('numberFormat', [numberExt]);

      const context = createContext({
        localVariables: new Map([['value', 'Int']]),
      });

      const result = resolveExtensionFunction(
        table,
        context,
        'value',
        'numberFormat'
      );

      // Int is compatible with Number
      expect(result).toBe('com.example.numberFormat');
    });
  });

  describe('fallback to all extensions', () => {
    it('should fall back to all extensions if receiver type unknown', () => {
      const extFunc = createExtensionFunction('com.example.process', 'Any');
      table.functionsByName.set('process', [extFunc]);

      const result = resolveExtensionFunction(
        table,
        createContext(),
        'unknownReceiver',
        'process'
      );

      expect(result).toBe('com.example.process');
    });
  });

  describe('overload resolution', () => {
    it('should return single matching extension directly', () => {
      const extFunc = createExtensionFunction('com.example.single', 'String');
      table.functionsByName.set('single', [extFunc]);

      const result = resolveExtensionFunction(
        table,
        createContext(),
        'str',
        'single'
      );

      expect(result).toBe('com.example.single');
    });

    it('should use overload resolution for multiple candidates', () => {
      const ext1 = createExtensionFunction('com.example.format1', 'String', {
        parameterTypes: ['Int'],
      });
      const ext2 = createExtensionFunction('com.example.format2', 'String', {
        parameterTypes: ['String'],
      });
      table.functionsByName.set('format', [ext1, ext2]);

      const context = createContext({
        localVariables: new Map([['str', 'String']]),
      });

      const result = resolveExtensionFunction(
        table,
        context,
        'str',
        'format',
        {
          name: 'format',
          location: createLocation(),
          argumentTypes: ['Int'],
        }
      );

      // Should pick ext1 based on argument type
      expect(result).toBe('com.example.format1');
    });
  });

  describe('mixed extension and regular functions', () => {
    it('should only consider extension functions', () => {
      const regularFunc: FunctionSymbol = {
        name: 'process',
        fqn: 'com.example.regularProcess',
        kind: 'function',
        filePath: '/src/Test.kt',
        location: createLocation(),
        packageName: 'com.example',
        parameterTypes: [],
        isExtension: false,
      };
      const extFunc = createExtensionFunction('com.example.extensionProcess', 'String', { name: 'process' });

      table.functionsByName.set('process', [regularFunc, extFunc]);

      const result = resolveExtensionFunction(
        table,
        createContext(),
        'str',
        'process'
      );

      expect(result).toBe('com.example.extensionProcess');
    });
  });
});
