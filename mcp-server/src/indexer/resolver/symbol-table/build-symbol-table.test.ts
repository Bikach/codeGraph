import { describe, it, expect } from 'vitest';
import { buildSymbolTable } from './build-symbol-table.js';
import type { ParsedFile, ParsedClass, ParsedFunction, SourceLocation } from '../../types.js';

describe('buildSymbolTable', () => {
  const defaultLocation: SourceLocation = {
    filePath: '/test/Test.kt',
    startLine: 1,
    startColumn: 0,
    endLine: 1,
    endColumn: 10,
  };

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

  describe('empty input', () => {
    it('should return empty table for empty files array', () => {
      const table = buildSymbolTable([]);

      expect(table.byFqn.size).toBe(0);
      expect(table.byName.size).toBe(0);
      expect(table.functionsByName.size).toBe(0);
      expect(table.byPackage.size).toBe(0);
      expect(table.typeHierarchy.size).toBe(0);
    });
  });

  describe('single file indexing', () => {
    it('should index classes from a single file', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [createClass({ name: 'UserService' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.UserService')).toBe(true);
    });

    it('should index top-level functions', () => {
      const file = createFile({
        packageName: 'com.example.utils',
        topLevelFunctions: [createFunction({ name: 'formatDate' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.utils.formatDate')).toBe(true);
    });
  });

  describe('multiple files indexing', () => {
    it('should index classes from multiple files', () => {
      const file1 = createFile({
        filePath: '/test/User.kt',
        packageName: 'com.example.domain',
        classes: [createClass({ name: 'User' })],
      });
      const file2 = createFile({
        filePath: '/test/Order.kt',
        packageName: 'com.example.domain',
        classes: [createClass({ name: 'Order' })],
      });

      const table = buildSymbolTable([file1, file2]);

      expect(table.byFqn.has('com.example.domain.User')).toBe(true);
      expect(table.byFqn.has('com.example.domain.Order')).toBe(true);
    });

    it('should handle same class name in different packages', () => {
      const file1 = createFile({
        filePath: '/test/a/Service.kt',
        packageName: 'com.example.a',
        classes: [createClass({ name: 'Service' })],
      });
      const file2 = createFile({
        filePath: '/test/b/Service.kt',
        packageName: 'com.example.b',
        classes: [createClass({ name: 'Service' })],
      });

      const table = buildSymbolTable([file1, file2]);

      expect(table.byFqn.has('com.example.a.Service')).toBe(true);
      expect(table.byFqn.has('com.example.b.Service')).toBe(true);
      expect(table.byName.get('Service')).toHaveLength(2);
    });
  });

  describe('type hierarchy', () => {
    it('should build type hierarchy for extends', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [
          createClass({ name: 'BaseService' }),
          createClass({ name: 'UserService', superClass: 'BaseService' }),
        ],
      });

      const table = buildSymbolTable([file]);

      const hierarchy = table.typeHierarchy.get('com.example.UserService');
      expect(hierarchy).toContain('com.example.BaseService');
    });

    it('should build type hierarchy for implements', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [
          createClass({ name: 'Repository', kind: 'interface' }),
          createClass({ name: 'UserRepository', interfaces: ['Repository'] }),
        ],
      });

      const table = buildSymbolTable([file]);

      const hierarchy = table.typeHierarchy.get('com.example.UserRepository');
      expect(hierarchy).toContain('com.example.Repository');
    });

    it('should build type hierarchy across files', () => {
      const file1 = createFile({
        filePath: '/test/Base.kt',
        packageName: 'com.example',
        classes: [createClass({ name: 'BaseEntity' })],
      });
      const file2 = createFile({
        filePath: '/test/User.kt',
        packageName: 'com.example',
        classes: [createClass({ name: 'User', superClass: 'BaseEntity' })],
      });

      const table = buildSymbolTable([file1, file2]);

      const hierarchy = table.typeHierarchy.get('com.example.User');
      expect(hierarchy).toContain('com.example.BaseEntity');
    });
  });

  describe('byName index', () => {
    it('should group symbols by name', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [
          createClass({ name: 'User' }),
          createClass({ name: 'Order' }),
        ],
      });

      const table = buildSymbolTable([file]);

      expect(table.byName.has('User')).toBe(true);
      expect(table.byName.has('Order')).toBe(true);
    });
  });

  describe('byPackage index', () => {
    it('should group symbols by package', () => {
      const file = createFile({
        packageName: 'com.example.domain',
        classes: [
          createClass({ name: 'User' }),
          createClass({ name: 'Order' }),
        ],
      });

      const table = buildSymbolTable([file]);

      const packageSymbols = table.byPackage.get('com.example.domain');
      expect(packageSymbols).toBeDefined();
      expect(packageSymbols!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('functionsByName index', () => {
    it('should group functions by name', () => {
      const file = createFile({
        packageName: 'com.example',
        classes: [
          createClass({
            name: 'Calculator',
            functions: [
              createFunction({ name: 'add', parameters: [{ name: 'a', type: 'Int', annotations: [] }] }),
              createFunction({ name: 'add', parameters: [{ name: 'a', type: 'Int', annotations: [] }, { name: 'b', type: 'Int', annotations: [] }] }),
            ],
          }),
        ],
      });

      const table = buildSymbolTable([file]);

      expect(table.functionsByName.has('add')).toBe(true);
      expect(table.functionsByName.get('add')).toHaveLength(2);
    });
  });

  describe('complex scenarios', () => {
    it('should handle nested classes', () => {
      const inner = createClass({ name: 'Inner' });
      const outer = createClass({ name: 'Outer', nestedClasses: [inner] });
      const file = createFile({
        packageName: 'com.example',
        classes: [outer],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.Outer')).toBe(true);
      expect(table.byFqn.has('com.example.Outer.Inner')).toBe(true);
    });

    it('should handle companion objects', () => {
      const companion = createClass({
        name: 'Companion',
        kind: 'object',
        functions: [createFunction({ name: 'create' })],
      });
      const cls = createClass({ name: 'User', companionObject: companion });
      const file = createFile({
        packageName: 'com.example',
        classes: [cls],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.User.Companion')).toBe(true);
      expect(table.byFqn.has('com.example.User.Companion.create')).toBe(true);
    });

    it('should handle type aliases', () => {
      const file = createFile({
        packageName: 'com.example',
        typeAliases: [
          { name: 'UserId', aliasedType: 'Long', visibility: 'public', location: defaultLocation },
        ],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.UserId')).toBe(true);
    });

    it('should handle files without package', () => {
      const file = createFile({
        classes: [createClass({ name: 'Script' })],
        topLevelFunctions: [createFunction({ name: 'main' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('Script')).toBe(true);
      expect(table.byFqn.has('main')).toBe(true);
    });
  });
});
