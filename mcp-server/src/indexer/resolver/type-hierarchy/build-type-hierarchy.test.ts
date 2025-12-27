import { describe, it, expect, beforeEach } from 'vitest';
import { buildTypeHierarchy } from './build-type-hierarchy.js';
import type { SymbolTable } from '../types.js';
import type { ParsedFile, ParsedClass } from '../../types.js';

describe('buildTypeHierarchy', () => {
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

  describe('single file processing', () => {
    it('should process all classes in a file', () => {
      const file = createFile({
        classes: [
          createClass({ name: 'ClassA', superClass: 'Base' }),
          createClass({ name: 'ClassB', interfaces: ['Interface1'] }),
        ],
      });

      buildTypeHierarchy(table, [file]);

      expect(table.typeHierarchy.get('com.example.ClassA')).toEqual(['Base']);
      expect(table.typeHierarchy.get('com.example.ClassB')).toEqual(['Interface1']);
    });

    it('should handle file with no classes', () => {
      const file = createFile({ classes: [] });

      buildTypeHierarchy(table, [file]);

      expect(table.typeHierarchy.size).toBe(0);
    });
  });

  describe('multiple files processing', () => {
    it('should process classes from multiple files', () => {
      const file1 = createFile({
        filePath: '/src/File1.kt',
        packageName: 'com.example.a',
        classes: [createClass({ name: 'ClassA', superClass: 'BaseA' })],
      });

      const file2 = createFile({
        filePath: '/src/File2.kt',
        packageName: 'com.example.b',
        classes: [createClass({ name: 'ClassB', superClass: 'BaseB' })],
      });

      buildTypeHierarchy(table, [file1, file2]);

      expect(table.typeHierarchy.get('com.example.a.ClassA')).toEqual(['BaseA']);
      expect(table.typeHierarchy.get('com.example.b.ClassB')).toEqual(['BaseB']);
    });

    it('should resolve cross-file references', () => {
      // First add ClassA to the symbol table
      table.byFqn.set('com.example.ClassA', {
        name: 'ClassA',
        fqn: 'com.example.ClassA',
        kind: 'class',
        filePath: '/src/ClassA.kt',
        location: createLocation('/src/ClassA.kt'),
        packageName: 'com.example',
      });

      const file1 = createFile({
        filePath: '/src/ClassA.kt',
        classes: [createClass({ name: 'ClassA' })],
      });

      const file2 = createFile({
        filePath: '/src/ClassB.kt',
        classes: [createClass({ name: 'ClassB', superClass: 'ClassA' })],
      });

      buildTypeHierarchy(table, [file1, file2]);

      expect(table.typeHierarchy.get('com.example.ClassB')).toEqual([
        'com.example.ClassA',
      ]);
    });
  });

  describe('package handling', () => {
    it('should handle files without package', () => {
      const file = createFile({
        packageName: '',
        classes: [createClass({ name: 'RootClass', superClass: 'Base' })],
      });

      buildTypeHierarchy(table, [file]);

      expect(table.typeHierarchy.get('RootClass')).toEqual(['Base']);
    });

    it('should handle undefined package as empty string', () => {
      const file = createFile({
        packageName: undefined,
        classes: [createClass({ name: 'RootClass', interfaces: ['Interface1'] })],
      });

      buildTypeHierarchy(table, [file]);

      expect(table.typeHierarchy.get('RootClass')).toEqual(['Interface1']);
    });
  });

  describe('nested classes', () => {
    it('should process nested classes within files', () => {
      const nestedClass = createClass({
        name: 'Inner',
        superClass: 'InnerBase',
      });

      const file = createFile({
        classes: [
          createClass({
            name: 'Outer',
            superClass: 'OuterBase',
            nestedClasses: [nestedClass],
          }),
        ],
      });

      buildTypeHierarchy(table, [file]);

      expect(table.typeHierarchy.get('com.example.Outer')).toEqual(['OuterBase']);
      expect(table.typeHierarchy.get('com.example.Outer.Inner')).toEqual(['InnerBase']);
    });
  });

  describe('empty input', () => {
    it('should handle empty files array', () => {
      buildTypeHierarchy(table, []);

      expect(table.typeHierarchy.size).toBe(0);
    });
  });
});
