import { describe, it, expect, beforeEach } from 'vitest';
import { indexFile } from './index-file.js';
import type { ParsedFile, ParsedClass, ParsedFunction, SourceLocation } from '../../types.js';
import type { SymbolTable, TypeAliasSymbol, PropertySymbol } from '../types.js';

describe('indexFile', () => {
  let table: SymbolTable;

  const defaultLocation: SourceLocation = {
    filePath: '/test/Test.kt',
    startLine: 1,
    startColumn: 0,
    endLine: 1,
    endColumn: 10,
  };

  const createEmptyTable = (): SymbolTable => ({
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  });

  const createFunction = (overrides: Partial<ParsedFunction> = {}): ParsedFunction => ({
    name: 'testFunction',
    visibility: 'public',
    parameters: [],
    isAbstract: false,
    isSuspend: false,
    isExtension: false,
    annotations: [],
    location: defaultLocation,
    calls: [],
    ...overrides,
  });

  const createClass = (overrides: Partial<ParsedClass> = {}): ParsedClass => ({
    name: 'TestClass',
    kind: 'class',
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    interfaces: [],
    annotations: [],
    properties: [],
    functions: [],
    nestedClasses: [],
    location: defaultLocation,
    ...overrides,
  });

  const createFile = (overrides: Partial<ParsedFile> = {}): ParsedFile => ({
    filePath: '/test/Test.kt',
    language: 'kotlin',
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

  beforeEach(() => {
    table = createEmptyTable();
  });

  describe('class indexing', () => {
    it('should index classes with package', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [createClass({ name: 'UserService' })],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.UserService')).toBe(true);
    });

    it('should index classes without package', () => {
      const file = createFile({
        classes: [createClass({ name: 'RootClass' })],
      });
      indexFile(table, file);

      expect(table.byFqn.has('RootClass')).toBe(true);
    });

    it('should index multiple classes', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [
          createClass({ name: 'User' }),
          createClass({ name: 'Order' }),
          createClass({ name: 'Product' }),
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.User')).toBe(true);
      expect(table.byFqn.has('com.example.Order')).toBe(true);
      expect(table.byFqn.has('com.example.Product')).toBe(true);
    });
  });

  describe('top-level function indexing', () => {
    it('should index top-level functions with package', () => {
      const file = createFile({
        packageName: 'com.example.utils',
        topLevelFunctions: [createFunction({ name: 'formatDate' })],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.utils.formatDate')).toBe(true);
    });

    it('should index top-level functions without package', () => {
      const file = createFile({
        topLevelFunctions: [createFunction({ name: 'main' })],
      });
      indexFile(table, file);

      expect(table.byFqn.has('main')).toBe(true);
    });

    it('should add to functionsByName', () => {
      const file = createFile({
        packageName: 'com.example',
        topLevelFunctions: [createFunction({ name: 'helper' })],
      });
      indexFile(table, file);

      expect(table.functionsByName.has('helper')).toBe(true);
    });
  });

  describe('top-level property indexing', () => {
    it('should index top-level properties with package', () => {
      const file = createFile({
        packageName: 'com.example',
        topLevelProperties: [
          { name: 'VERSION', type: 'String', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.VERSION')).toBe(true);
    });

    it('should index top-level properties without package', () => {
      const file = createFile({
        topLevelProperties: [
          { name: 'DEBUG', type: 'Boolean', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('DEBUG')).toBe(true);
    });

    it('should set property kind correctly', () => {
      const file = createFile({
        packageName: 'com.example',
        topLevelProperties: [
          { name: 'config', type: 'Config', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      indexFile(table, file);

      const prop = table.byFqn.get('com.example.config');
      expect(prop?.kind).toBe('property');
    });
  });

  describe('type alias indexing', () => {
    it('should index type aliases with package', () => {
      const file = createFile({
        packageName: 'com.example',
        typeAliases: [
          { name: 'UserId', aliasedType: 'Long', visibility: 'public', location: defaultLocation },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.UserId')).toBe(true);
    });

    it('should index type aliases without package', () => {
      const file = createFile({
        typeAliases: [
          { name: 'StringList', aliasedType: 'List<String>', visibility: 'public', location: defaultLocation },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('StringList')).toBe(true);
    });

    it('should set type alias metadata', () => {
      const file = createFile({
        packageName: 'com.example',
        typeAliases: [
          { name: 'Handler', aliasedType: '(Event) -> Unit', visibility: 'public', location: defaultLocation },
        ],
      });
      indexFile(table, file);

      const alias = table.byFqn.get('com.example.Handler') as TypeAliasSymbol;
      expect(alias.kind).toBe('typealias');
      expect(alias.aliasedType).toBe('(Event) -> Unit');
    });
  });

  describe('destructuring declaration indexing', () => {
    it('should index destructuring components', () => {
      const file = createFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['x', 'y', 'z'],
            componentTypes: ['Int', 'Int', 'Int'],
            isVal: true,
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.x')).toBe(true);
      expect(table.byFqn.has('com.example.y')).toBe(true);
      expect(table.byFqn.has('com.example.z')).toBe(true);
    });

    it('should skip underscore components', () => {
      const file = createFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['first', '_', 'third'],
            isVal: true,
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.first')).toBe(true);
      expect(table.byFqn.has('com.example._')).toBe(false);
      expect(table.byFqn.has('com.example.third')).toBe(true);
    });

    it('should set component types', () => {
      const file = createFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['name', 'age'],
            componentTypes: ['String', 'Int'],
            isVal: true,
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });
      indexFile(table, file);

      const name = table.byFqn.get('com.example.name') as PropertySymbol;
      const age = table.byFqn.get('com.example.age') as PropertySymbol;
      expect(name.type).toBe('String');
      expect(age.type).toBe('Int');
    });

    it('should set isVal correctly', () => {
      const file = createFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['mutable'],
            isVal: false,
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });
      indexFile(table, file);

      const prop = table.byFqn.get('com.example.mutable') as PropertySymbol;
      expect(prop.isVal).toBe(false);
    });
  });

  describe('object expression indexing', () => {
    it('should index anonymous object expressions', () => {
      const file = createFile({
        packageName: 'com.example',
        objectExpressions: [
          {
            superTypes: ['Runnable'],
            functions: [],
            properties: [],
            location: { ...defaultLocation, startLine: 10 },
          },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.<anonymous>@10')).toBe(true);
    });

    it('should index object expression without package', () => {
      const file = createFile({
        objectExpressions: [
          {
            superTypes: ['Comparator'],
            functions: [],
            properties: [],
            location: { ...defaultLocation, startLine: 5 },
          },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('<anonymous>@5')).toBe(true);
    });

    it('should index functions in object expressions', () => {
      const file = createFile({
        packageName: 'com.example',
        objectExpressions: [
          {
            superTypes: ['Runnable'],
            functions: [createFunction({ name: 'run' })],
            properties: [],
            location: { ...defaultLocation, startLine: 10 },
          },
        ],
      });
      indexFile(table, file);

      expect(table.byFqn.has('com.example.<anonymous>@10.run')).toBe(true);
    });

    it('should set object expression kind correctly', () => {
      const file = createFile({
        packageName: 'com.example',
        objectExpressions: [
          {
            superTypes: [],
            functions: [],
            properties: [],
            location: { ...defaultLocation, startLine: 1 },
          },
        ],
      });
      indexFile(table, file);

      const obj = table.byFqn.get('com.example.<anonymous>@1');
      expect(obj?.kind).toBe('object');
    });
  });

  describe('empty file handling', () => {
    it('should handle empty file', () => {
      const file = createFile({});
      indexFile(table, file);

      expect(table.byFqn.size).toBe(0);
    });
  });

  describe('package indexing', () => {
    it('should add symbols to byPackage index', () => {
      const file = createFile({
        packageName: 'com.example.domain',
        classes: [createClass({ name: 'User' })],
        topLevelFunctions: [createFunction({ name: 'createUser' })],
      });
      indexFile(table, file);

      const packageSymbols = table.byPackage.get('com.example.domain');
      expect(packageSymbols).toBeDefined();
      expect(packageSymbols!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('file path propagation', () => {
    it('should set correct file path on all symbols', () => {
      const file = createFile({
        filePath: '/src/main/kotlin/Service.kt',
        packageName: 'com.example',
        classes: [createClass({ name: 'Service' })],
        topLevelFunctions: [createFunction({ name: 'helper' })],
      });
      indexFile(table, file);

      const classSymbol = table.byFqn.get('com.example.Service');
      const funcSymbol = table.byFqn.get('com.example.helper');
      expect(classSymbol?.filePath).toBe('/src/main/kotlin/Service.kt');
      expect(funcSymbol?.filePath).toBe('/src/main/kotlin/Service.kt');
    });
  });
});
