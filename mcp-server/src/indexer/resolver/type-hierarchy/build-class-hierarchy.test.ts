import { describe, it, expect, beforeEach } from 'vitest';
import { buildClassHierarchy } from './build-class-hierarchy.js';
import type { SymbolTable } from '../types.js';
import type { ParsedClass } from '../../types.js';

describe('buildClassHierarchy', () => {
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

  describe('superclass resolution', () => {
    it('should add resolved superclass to hierarchy', () => {
      table.byFqn.set('com.example.BaseClass', {
        name: 'BaseClass',
        fqn: 'com.example.BaseClass',
        kind: 'class',
        filePath: '/src/BaseClass.kt',
        location: createLocation('/src/BaseClass.kt'),
        packageName: 'com.example',
      });

      const cls = createClass({
        name: 'ChildClass',
        superClass: 'BaseClass',
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.ChildClass')).toEqual([
        'com.example.BaseClass',
      ]);
    });

    it('should keep unresolved superclass as-is', () => {
      const cls = createClass({
        name: 'ChildClass',
        superClass: 'ExternalBase',
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.ChildClass')).toEqual([
        'ExternalBase',
      ]);
    });
  });

  describe('interface resolution', () => {
    it('should add resolved interfaces to hierarchy', () => {
      table.byFqn.set('com.example.Repository', {
        name: 'Repository',
        fqn: 'com.example.Repository',
        kind: 'interface',
        filePath: '/src/Repository.kt',
        location: createLocation('/src/Repository.kt'),
        packageName: 'com.example',
      });
      table.byFqn.set('com.example.Serializable', {
        name: 'Serializable',
        fqn: 'com.example.Serializable',
        kind: 'interface',
        filePath: '/src/Serializable.kt',
        location: createLocation('/src/Serializable.kt'),
        packageName: 'com.example',
      });

      const cls = createClass({
        name: 'UserRepository',
        interfaces: ['Repository', 'Serializable'],
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.UserRepository')).toEqual([
        'com.example.Repository',
        'com.example.Serializable',
      ]);
    });

    it('should keep unresolved interfaces as-is', () => {
      const cls = createClass({
        name: 'UserRepository',
        interfaces: ['ExternalInterface'],
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.UserRepository')).toEqual([
        'ExternalInterface',
      ]);
    });
  });

  describe('combined inheritance', () => {
    it('should handle superclass and interfaces together', () => {
      table.byFqn.set('com.example.BaseService', {
        name: 'BaseService',
        fqn: 'com.example.BaseService',
        kind: 'class',
        filePath: '/src/BaseService.kt',
        location: createLocation('/src/BaseService.kt'),
        packageName: 'com.example',
      });
      table.byFqn.set('com.example.Closeable', {
        name: 'Closeable',
        fqn: 'com.example.Closeable',
        kind: 'interface',
        filePath: '/src/Closeable.kt',
        location: createLocation('/src/Closeable.kt'),
        packageName: 'com.example',
      });

      const cls = createClass({
        name: 'UserService',
        superClass: 'BaseService',
        interfaces: ['Closeable'],
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.UserService')).toEqual([
        'com.example.BaseService',
        'com.example.Closeable',
      ]);
    });
  });

  describe('nested classes', () => {
    it('should process nested classes recursively', () => {
      table.byFqn.set('com.example.BaseNested', {
        name: 'BaseNested',
        fqn: 'com.example.BaseNested',
        kind: 'class',
        filePath: '/src/BaseNested.kt',
        location: createLocation('/src/BaseNested.kt'),
        packageName: 'com.example',
      });

      const nestedClass = createClass({
        name: 'Inner',
        superClass: 'BaseNested',
      });

      const cls = createClass({
        name: 'Outer',
        nestedClasses: [nestedClass],
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.Outer.Inner')).toEqual([
        'com.example.BaseNested',
      ]);
    });

    it('should handle deeply nested classes', () => {
      const deepNested = createClass({
        name: 'DeepNested',
        interfaces: ['DeepInterface'],
      });

      const middleNested = createClass({
        name: 'Middle',
        nestedClasses: [deepNested],
      });

      const cls = createClass({
        name: 'Outer',
        nestedClasses: [middleNested],
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.get('com.example.Outer.Middle.DeepNested')).toEqual([
        'DeepInterface',
      ]);
    });
  });

  describe('FQN generation', () => {
    it('should generate correct FQN with package', () => {
      const cls = createClass({
        name: 'MyClass',
        superClass: 'Base',
      });

      buildClassHierarchy(table, cls, 'com.example.domain');

      expect(table.typeHierarchy.has('com.example.domain.MyClass')).toBe(true);
    });

    it('should generate correct FQN without package', () => {
      const cls = createClass({
        name: 'MyClass',
        superClass: 'Base',
      });

      buildClassHierarchy(table, cls, '');

      expect(table.typeHierarchy.has('MyClass')).toBe(true);
    });

    it('should generate correct FQN for nested class with parent FQN', () => {
      const cls = createClass({
        name: 'Nested',
        interfaces: ['SomeInterface'],
      });

      buildClassHierarchy(table, cls, 'com.example', 'com.example.Parent');

      expect(table.typeHierarchy.has('com.example.Parent.Nested')).toBe(true);
    });
  });

  describe('no inheritance', () => {
    it('should not add entry when no superclass or interfaces', () => {
      const cls = createClass({
        name: 'StandaloneClass',
      });

      buildClassHierarchy(table, cls, 'com.example');

      expect(table.typeHierarchy.has('com.example.StandaloneClass')).toBe(false);
    });
  });
});
