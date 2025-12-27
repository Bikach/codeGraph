import { describe, it, expect, beforeEach } from 'vitest';
import { indexFunction } from './index-function.js';
import type { ParsedFunction, SourceLocation } from '../../types.js';
import type { SymbolTable, FunctionSymbol } from '../types.js';

describe('indexFunction', () => {
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

  beforeEach(() => {
    table = createEmptyTable();
  });

  describe('FQN generation', () => {
    it('should create FQN with package and declaring type', () => {
      const func = createFunction({ name: 'save' });
      indexFunction(table, func, 'com.example', '/test/Test.kt', 'com.example.UserService');

      expect(table.byFqn.has('com.example.UserService.save')).toBe(true);
    });

    it('should create FQN with package only (top-level function)', () => {
      const func = createFunction({ name: 'formatDate' });
      indexFunction(table, func, 'com.example.utils', '/test/Test.kt', undefined);

      expect(table.byFqn.has('com.example.utils.formatDate')).toBe(true);
    });

    it('should create FQN without package (root level)', () => {
      const func = createFunction({ name: 'main' });
      indexFunction(table, func, '', '/test/Test.kt', undefined);

      expect(table.byFqn.has('main')).toBe(true);
    });

    it('should handle nested class functions', () => {
      const func = createFunction({ name: 'innerMethod' });
      indexFunction(table, func, 'com.example', '/test/Test.kt', 'com.example.Outer.Inner');

      expect(table.byFqn.has('com.example.Outer.Inner.innerMethod')).toBe(true);
    });
  });

  describe('function symbol properties', () => {
    it('should set correct kind', () => {
      const func = createFunction({ name: 'process' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.process') as FunctionSymbol;
      expect(symbol.kind).toBe('function');
    });

    it('should set file path and location', () => {
      const func = createFunction({ name: 'test', location: { ...defaultLocation, startLine: 42 } });
      indexFunction(table, func, 'com.example', '/src/Service.kt');

      const symbol = table.byFqn.get('com.example.test') as FunctionSymbol;
      expect(symbol.filePath).toBe('/src/Service.kt');
      expect(symbol.location.startLine).toBe(42);
    });

    it('should set declaring type FQN', () => {
      const func = createFunction({ name: 'method' });
      indexFunction(table, func, 'com.example', '/test/Test.kt', 'com.example.Service');

      const symbol = table.byFqn.get('com.example.Service.method') as FunctionSymbol;
      expect(symbol.declaringTypeFqn).toBe('com.example.Service');
    });

    it('should set package name', () => {
      const func = createFunction({ name: 'util' });
      indexFunction(table, func, 'com.example.utils', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.utils.util') as FunctionSymbol;
      expect(symbol.packageName).toBe('com.example.utils');
    });
  });

  describe('parameter types', () => {
    it('should extract parameter types', () => {
      const func = createFunction({
        name: 'process',
        parameters: [
          { name: 'id', type: 'Long', annotations: [] },
          { name: 'name', type: 'String', annotations: [] },
        ],
      });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.process') as FunctionSymbol;
      expect(symbol.parameterTypes).toEqual(['Long', 'String']);
    });

    it('should use Any for parameters without type', () => {
      const func = createFunction({
        name: 'process',
        parameters: [
          { name: 'value', annotations: [] },
        ],
      });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.process') as FunctionSymbol;
      expect(symbol.parameterTypes).toEqual(['Any']);
    });

    it('should handle empty parameters', () => {
      const func = createFunction({ name: 'noArgs', parameters: [] });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.noArgs') as FunctionSymbol;
      expect(symbol.parameterTypes).toEqual([]);
    });
  });

  describe('extension functions', () => {
    it('should set isExtension flag', () => {
      const func = createFunction({ name: 'capitalize', isExtension: true, receiverType: 'String' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.capitalize') as FunctionSymbol;
      expect(symbol.isExtension).toBe(true);
    });

    it('should set receiver type', () => {
      const func = createFunction({ name: 'toJson', isExtension: true, receiverType: 'Any' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.toJson') as FunctionSymbol;
      expect(symbol.receiverType).toBe('Any');
    });
  });

  describe('Kotlin-specific modifiers', () => {
    it('should set isSuspend flag', () => {
      const func = createFunction({ name: 'fetch', isSuspend: true });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.fetch') as FunctionSymbol;
      expect(symbol.isSuspend).toBe(true);
    });

    it('should set isInline flag', () => {
      const func = createFunction({ name: 'run', isInline: true });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.run') as FunctionSymbol;
      expect(symbol.isInline).toBe(true);
    });

    it('should set isOperator flag', () => {
      const func = createFunction({ name: 'plus', isOperator: true });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.plus') as FunctionSymbol;
      expect(symbol.isOperator).toBe(true);
    });

    it('should set isInfix flag', () => {
      const func = createFunction({ name: 'to', isInfix: true });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.to') as FunctionSymbol;
      expect(symbol.isInfix).toBe(true);
    });

    it('should not set false values as undefined', () => {
      const func = createFunction({ name: 'regular', isSuspend: false, isInline: false });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.regular') as FunctionSymbol;
      expect(symbol.isSuspend).toBeUndefined();
      expect(symbol.isInline).toBeUndefined();
    });
  });

  describe('return type', () => {
    it('should set return type', () => {
      const func = createFunction({ name: 'getId', returnType: 'Long' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.getId') as FunctionSymbol;
      expect(symbol.returnType).toBe('Long');
    });

    it('should handle undefined return type', () => {
      const func = createFunction({ name: 'doSomething' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      const symbol = table.byFqn.get('com.example.doSomething') as FunctionSymbol;
      expect(symbol.returnType).toBeUndefined();
    });
  });

  describe('functionsByName index', () => {
    it('should add function to functionsByName', () => {
      const func = createFunction({ name: 'save' });
      indexFunction(table, func, 'com.example', '/test/Test.kt', 'com.example.Service');

      expect(table.functionsByName.has('save')).toBe(true);
      expect(table.functionsByName.get('save')).toHaveLength(1);
    });

    it('should group overloaded functions by name', () => {
      const func1 = createFunction({
        name: 'add',
        parameters: [{ name: 'a', type: 'Int', annotations: [] }],
      });
      const func2 = createFunction({
        name: 'add',
        parameters: [
          { name: 'a', type: 'Int', annotations: [] },
          { name: 'b', type: 'Int', annotations: [] },
        ],
      });

      indexFunction(table, func1, 'com.example', '/test/Test.kt', 'com.example.Calculator');
      indexFunction(table, func2, 'com.example', '/test/Test.kt', 'com.example.Calculator');

      const addFunctions = table.functionsByName.get('add');
      expect(addFunctions).toHaveLength(2);
    });

    it('should include functions from different classes with same name', () => {
      const func1 = createFunction({ name: 'process' });
      const func2 = createFunction({ name: 'process' });

      indexFunction(table, func1, 'com.example', '/test/A.kt', 'com.example.ServiceA');
      indexFunction(table, func2, 'com.example', '/test/B.kt', 'com.example.ServiceB');

      const processFunctions = table.functionsByName.get('process');
      expect(processFunctions).toHaveLength(2);
      expect(processFunctions?.map(f => f.declaringTypeFqn)).toContain('com.example.ServiceA');
      expect(processFunctions?.map(f => f.declaringTypeFqn)).toContain('com.example.ServiceB');
    });
  });

  describe('byName index', () => {
    it('should add function to byName index', () => {
      const func = createFunction({ name: 'myFunction' });
      indexFunction(table, func, 'com.example', '/test/Test.kt');

      expect(table.byName.has('myFunction')).toBe(true);
    });
  });

  describe('byPackage index', () => {
    it('should add function to byPackage index', () => {
      const func = createFunction({ name: 'util' });
      indexFunction(table, func, 'com.example.utils', '/test/Test.kt');

      const packageSymbols = table.byPackage.get('com.example.utils');
      expect(packageSymbols?.find(s => s.name === 'util')).toBeDefined();
    });
  });
});
