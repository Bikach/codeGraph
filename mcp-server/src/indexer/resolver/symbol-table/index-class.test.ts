import { describe, it, expect, beforeEach } from 'vitest';
import { indexClass } from './index-class.js';
import type { ParsedClass, ParsedFunction, SourceLocation } from '../../types.js';
import type { SymbolTable, ClassSymbol, PropertySymbol } from '../types.js';

describe('indexClass', () => {
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

  beforeEach(() => {
    table = createEmptyTable();
  });

  describe('class FQN generation', () => {
    it('should create FQN with package', () => {
      const cls = createClass({ name: 'UserService' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.UserService')).toBe(true);
    });

    it('should create FQN without package', () => {
      const cls = createClass({ name: 'RootClass' });
      indexClass(table, cls, '', '/test/Test.kt');

      expect(table.byFqn.has('RootClass')).toBe(true);
    });

    it('should create FQN with parent for nested class', () => {
      const cls = createClass({ name: 'Inner' });
      indexClass(table, cls, 'com.example', '/test/Test.kt', 'com.example.Outer');

      expect(table.byFqn.has('com.example.Outer.Inner')).toBe(true);
    });
  });

  describe('class symbol properties', () => {
    it('should set correct kind for class', () => {
      const cls = createClass({ kind: 'class' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.TestClass') as ClassSymbol;
      expect(symbol.kind).toBe('class');
    });

    it('should set correct kind for interface', () => {
      const cls = createClass({ name: 'Repository', kind: 'interface' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Repository') as ClassSymbol;
      expect(symbol.kind).toBe('interface');
    });

    it('should set correct kind for object', () => {
      const cls = createClass({ name: 'Singleton', kind: 'object' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Singleton') as ClassSymbol;
      expect(symbol.kind).toBe('object');
    });

    it('should set correct kind for enum', () => {
      const cls = createClass({ name: 'Status', kind: 'enum' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Status') as ClassSymbol;
      expect(symbol.kind).toBe('enum');
    });

    it('should set file path and location', () => {
      const cls = createClass({ location: { ...defaultLocation, startLine: 10 } });
      indexClass(table, cls, 'com.example', '/src/Service.kt');

      const symbol = table.byFqn.get('com.example.TestClass') as ClassSymbol;
      expect(symbol.filePath).toBe('/src/Service.kt');
      expect(symbol.location.startLine).toBe(10);
    });

    it('should set parent FQN for nested class', () => {
      const cls = createClass({ name: 'Inner' });
      indexClass(table, cls, 'com.example', '/test/Test.kt', 'com.example.Outer');

      const symbol = table.byFqn.get('com.example.Outer.Inner') as ClassSymbol;
      expect(symbol.parentFqn).toBe('com.example.Outer');
    });

    it('should set package name', () => {
      const cls = createClass();
      indexClass(table, cls, 'com.example.domain', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.domain.TestClass') as ClassSymbol;
      expect(symbol.packageName).toBe('com.example.domain');
    });
  });

  describe('inheritance info', () => {
    it('should set superClass', () => {
      const cls = createClass({ name: 'Child', superClass: 'Parent' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Child') as ClassSymbol;
      expect(symbol.superClass).toBe('Parent');
    });

    it('should set interfaces', () => {
      const cls = createClass({ name: 'Impl', interfaces: ['InterfaceA', 'InterfaceB'] });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Impl') as ClassSymbol;
      expect(symbol.interfaces).toEqual(['InterfaceA', 'InterfaceB']);
    });
  });

  describe('Kotlin-specific metadata', () => {
    it('should set isData for data class', () => {
      const cls = createClass({ name: 'Person', isData: true });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Person') as ClassSymbol;
      expect(symbol.isData).toBe(true);
    });

    it('should set isSealed for sealed class', () => {
      const cls = createClass({ name: 'Result', isSealed: true });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.Result') as ClassSymbol;
      expect(symbol.isSealed).toBe(true);
    });

    it('should set isAbstract for abstract class', () => {
      const cls = createClass({ name: 'BaseService', isAbstract: true });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.BaseService') as ClassSymbol;
      expect(symbol.isAbstract).toBe(true);
    });

    it('should not set false values as undefined', () => {
      const cls = createClass({ isData: false, isSealed: false, isAbstract: false });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.TestClass') as ClassSymbol;
      expect(symbol.isData).toBeUndefined();
      expect(symbol.isSealed).toBeUndefined();
      expect(symbol.isAbstract).toBeUndefined();
    });
  });

  describe('function indexing', () => {
    it('should index class functions', () => {
      const cls = createClass({
        name: 'Service',
        functions: [createFunction({ name: 'process' })],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.Service.process')).toBe(true);
    });

    it('should index multiple functions', () => {
      const cls = createClass({
        name: 'Service',
        functions: [
          createFunction({ name: 'save' }),
          createFunction({ name: 'delete' }),
          createFunction({ name: 'update' }),
        ],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.Service.save')).toBe(true);
      expect(table.byFqn.has('com.example.Service.delete')).toBe(true);
      expect(table.byFqn.has('com.example.Service.update')).toBe(true);
    });

    it('should add functions to functionsByName', () => {
      const cls = createClass({
        name: 'Service',
        functions: [createFunction({ name: 'process' })],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.functionsByName.has('process')).toBe(true);
    });
  });

  describe('property indexing', () => {
    it('should index class properties', () => {
      const cls = createClass({
        name: 'User',
        properties: [
          { name: 'id', type: 'Long', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.id')).toBe(true);
    });

    it('should set property metadata', () => {
      const cls = createClass({
        name: 'User',
        properties: [
          { name: 'name', type: 'String', visibility: 'private', isVal: false, annotations: [], location: defaultLocation },
        ],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const prop = table.byFqn.get('com.example.User.name') as PropertySymbol;
      expect(prop.kind).toBe('property');
      expect(prop.type).toBe('String');
      expect(prop.isVal).toBe(false);
      expect(prop.parentFqn).toBe('com.example.User');
    });

    it('should index multiple properties', () => {
      const cls = createClass({
        name: 'User',
        properties: [
          { name: 'id', type: 'Long', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
          { name: 'name', type: 'String', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.id')).toBe(true);
      expect(table.byFqn.has('com.example.User.name')).toBe(true);
    });
  });

  describe('nested classes', () => {
    it('should index nested class', () => {
      const inner = createClass({ name: 'Inner' });
      const outer = createClass({ name: 'Outer', nestedClasses: [inner] });
      indexClass(table, outer, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.Outer')).toBe(true);
      expect(table.byFqn.has('com.example.Outer.Inner')).toBe(true);
    });

    it('should index deeply nested classes', () => {
      const deep = createClass({ name: 'Deep' });
      const middle = createClass({ name: 'Middle', nestedClasses: [deep] });
      const outer = createClass({ name: 'Outer', nestedClasses: [middle] });
      indexClass(table, outer, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.Outer.Middle.Deep')).toBe(true);
    });

    it('should index nested class functions', () => {
      const inner = createClass({
        name: 'Inner',
        functions: [createFunction({ name: 'innerMethod' })],
      });
      const outer = createClass({ name: 'Outer', nestedClasses: [inner] });
      indexClass(table, outer, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.Outer.Inner.innerMethod')).toBe(true);
    });
  });

  describe('companion object', () => {
    it('should index companion object', () => {
      const companion = createClass({ name: 'Companion', kind: 'object' });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.Companion')).toBe(true);
    });

    it('should index named companion object', () => {
      const companion = createClass({ name: 'Factory', kind: 'object' });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.Factory')).toBe(true);
    });

    it('should index anonymous companion as Companion', () => {
      const companion = createClass({ name: '<anonymous>', kind: 'object' });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.Companion')).toBe(true);
    });

    it('should index companion functions', () => {
      const companion = createClass({
        name: 'Companion',
        kind: 'object',
        functions: [createFunction({ name: 'create' })],
      });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.Companion.create')).toBe(true);
    });

    it('should index companion properties', () => {
      const companion = createClass({
        name: 'Companion',
        kind: 'object',
        properties: [
          { name: 'DEFAULT', type: 'User', visibility: 'public', isVal: true, annotations: [], location: defaultLocation },
        ],
      });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byFqn.has('com.example.User.Companion.DEFAULT')).toBe(true);
    });

    it('should set companion parent FQN correctly', () => {
      const companion = createClass({ name: 'Companion', kind: 'object' });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const companionSymbol = table.byFqn.get('com.example.User.Companion') as ClassSymbol;
      expect(companionSymbol.parentFqn).toBe('com.example.User');
    });

    it('should set companion inheritance info', () => {
      const companion = createClass({
        name: 'Companion',
        kind: 'object',
        superClass: 'BaseCompanion',
        interfaces: ['Factory'],
      });
      const cls = createClass({ name: 'User', companionObject: companion });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      const companionSymbol = table.byFqn.get('com.example.User.Companion') as ClassSymbol;
      expect(companionSymbol.superClass).toBe('BaseCompanion');
      expect(companionSymbol.interfaces).toContain('Factory');
    });
  });

  describe('indexes', () => {
    it('should add class to byName index', () => {
      const cls = createClass({ name: 'Service' });
      indexClass(table, cls, 'com.example', '/test/Test.kt');

      expect(table.byName.has('Service')).toBe(true);
    });

    it('should add class to byPackage index', () => {
      const cls = createClass({ name: 'Service' });
      indexClass(table, cls, 'com.example.services', '/test/Test.kt');

      const packageSymbols = table.byPackage.get('com.example.services');
      expect(packageSymbols?.find(s => s.name === 'Service')).toBeDefined();
    });
  });
});
