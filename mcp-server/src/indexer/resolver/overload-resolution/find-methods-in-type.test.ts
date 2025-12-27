import { describe, it, expect } from 'vitest';
import { findMethodsInType } from './find-methods-in-type.js';
import type { SymbolTable, FunctionSymbol } from '../types.js';

function createEmptySymbolTable(): SymbolTable {
  return {
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  };
}

function createFunctionSymbol(
  name: string,
  declaringTypeFqn: string,
  parameterTypes: string[] = []
): FunctionSymbol {
  const fqn = `${declaringTypeFqn}.${name}`;
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '/test/Test.kt',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    packageName: 'com.example',
    declaringTypeFqn,
    parameterTypes,
    isExtension: false,
  };
}

function addFunctionToTable(table: SymbolTable, func: FunctionSymbol): void {
  table.byFqn.set(func.fqn, func);
  const existing = table.functionsByName.get(func.name) || [];
  existing.push(func);
  table.functionsByName.set(func.name, existing);
}

describe('findMethodsInType', () => {
  it('should return empty array when no methods found', () => {
    const table = createEmptySymbolTable();
    expect(findMethodsInType(table, 'com.example.User', 'save')).toEqual([]);
  });

  it('should find method by declaring type FQN', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('save', 'com.example.UserService');
    addFunctionToTable(table, func);

    const results = findMethodsInType(table, 'com.example.UserService', 'save');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(func);
  });

  it('should find method by exact FQN when not in functionsByName', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('save', 'com.example.UserService');
    // Only add to byFqn, not to functionsByName
    table.byFqn.set(func.fqn, func);

    const results = findMethodsInType(table, 'com.example.UserService', 'save');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(func);
  });

  it('should find multiple overloaded methods', () => {
    const table = createEmptySymbolTable();
    const func1 = createFunctionSymbol('save', 'com.example.UserService', ['User']);
    const func2 = createFunctionSymbol('save', 'com.example.UserService', ['User', 'Boolean']);

    // Give them unique FQNs for overloads
    func2.fqn = 'com.example.UserService.save#2';

    addFunctionToTable(table, func1);
    addFunctionToTable(table, func2);

    const results = findMethodsInType(table, 'com.example.UserService', 'save');
    expect(results).toHaveLength(2);
  });

  it('should not include methods from other types', () => {
    const table = createEmptySymbolTable();
    const func1 = createFunctionSymbol('save', 'com.example.UserService');
    const func2 = createFunctionSymbol('save', 'com.example.AdminService');

    addFunctionToTable(table, func1);
    addFunctionToTable(table, func2);

    const results = findMethodsInType(table, 'com.example.UserService', 'save');
    expect(results).toHaveLength(1);
    expect(results[0]?.declaringTypeFqn).toBe('com.example.UserService');
  });

  it('should not duplicate when found in both functionsByName and byFqn', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('save', 'com.example.UserService');
    addFunctionToTable(table, func);

    const results = findMethodsInType(table, 'com.example.UserService', 'save');
    expect(results).toHaveLength(1);
  });

  it('should handle nested class methods', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('process', 'com.example.Outer.Inner');
    addFunctionToTable(table, func);

    const results = findMethodsInType(table, 'com.example.Outer.Inner', 'process');
    expect(results).toHaveLength(1);
    expect(results[0]?.fqn).toBe('com.example.Outer.Inner.process');
  });
});
