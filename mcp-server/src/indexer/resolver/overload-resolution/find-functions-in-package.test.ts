import { describe, it, expect } from 'vitest';
import { findFunctionsInPackage } from './find-functions-in-package.js';
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
  packageName: string,
  declaringTypeFqn?: string
): FunctionSymbol {
  const fqn = declaringTypeFqn ? `${declaringTypeFqn}.${name}` : `${packageName}.${name}`;
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '/test/Test.kt',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    packageName,
    declaringTypeFqn,
    parameterTypes: [],
    isExtension: false,
  };
}

function addFunctionToTable(table: SymbolTable, func: FunctionSymbol): void {
  const existing = table.functionsByName.get(func.name) || [];
  existing.push(func);
  table.functionsByName.set(func.name, existing);
}

describe('findFunctionsInPackage', () => {
  it('should return empty array when no functions found', () => {
    const table = createEmptySymbolTable();
    expect(findFunctionsInPackage(table, 'com.example', 'doSomething')).toEqual([]);
  });

  it('should find top-level function in package', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('doSomething', 'com.example');
    addFunctionToTable(table, func);

    const results = findFunctionsInPackage(table, 'com.example', 'doSomething');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(func);
  });

  it('should not find functions in other packages', () => {
    const table = createEmptySymbolTable();
    const func = createFunctionSymbol('doSomething', 'com.other');
    addFunctionToTable(table, func);

    const results = findFunctionsInPackage(table, 'com.example', 'doSomething');
    expect(results).toHaveLength(0);
  });

  it('should not find class methods (with declaringTypeFqn)', () => {
    const table = createEmptySymbolTable();
    const topLevel = createFunctionSymbol('doSomething', 'com.example');
    const classMethod = createFunctionSymbol('doSomething', 'com.example', 'com.example.MyClass');
    addFunctionToTable(table, topLevel);
    addFunctionToTable(table, classMethod);

    const results = findFunctionsInPackage(table, 'com.example', 'doSomething');
    expect(results).toHaveLength(1);
    expect(results[0]?.declaringTypeFqn).toBeUndefined();
  });

  it('should find multiple top-level functions with same name (overloads)', () => {
    const table = createEmptySymbolTable();
    const func1 = createFunctionSymbol('parse', 'com.example');
    const func2 = createFunctionSymbol('parse', 'com.example');
    func2.fqn = 'com.example.parse#2'; // Different FQN for overload

    addFunctionToTable(table, func1);
    addFunctionToTable(table, func2);

    const results = findFunctionsInPackage(table, 'com.example', 'parse');
    expect(results).toHaveLength(2);
  });

  it('should handle nested package names correctly', () => {
    const table = createEmptySymbolTable();
    const func1 = createFunctionSymbol('init', 'com.example.utils');
    const func2 = createFunctionSymbol('init', 'com.example');
    addFunctionToTable(table, func1);
    addFunctionToTable(table, func2);

    const results = findFunctionsInPackage(table, 'com.example.utils', 'init');
    expect(results).toHaveLength(1);
    expect(results[0]?.packageName).toBe('com.example.utils');
  });
});
