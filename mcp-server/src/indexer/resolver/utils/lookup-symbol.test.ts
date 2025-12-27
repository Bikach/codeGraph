import { describe, it, expect } from 'vitest';
import { lookupSymbol } from './lookup-symbol.js';
import type { SymbolTable, Symbol } from '../types.js';

function createEmptySymbolTable(): SymbolTable {
  return {
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  };
}

function createSymbol(name: string, fqn: string): Symbol {
  return {
    name,
    fqn,
    kind: 'class',
    filePath: '/test/Test.kt',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    packageName: 'com.example',
  };
}

describe('lookupSymbol', () => {
  it('should return undefined for empty table', () => {
    const table = createEmptySymbolTable();
    expect(lookupSymbol(table, 'com.example.User')).toBeUndefined();
  });

  it('should find symbol by exact FQN', () => {
    const table = createEmptySymbolTable();
    const symbol = createSymbol('User', 'com.example.User');
    table.byFqn.set('com.example.User', symbol);

    const result = lookupSymbol(table, 'com.example.User');
    expect(result).toBe(symbol);
  });

  it('should return undefined for non-existent FQN', () => {
    const table = createEmptySymbolTable();
    const symbol = createSymbol('User', 'com.example.User');
    table.byFqn.set('com.example.User', symbol);

    expect(lookupSymbol(table, 'com.example.Admin')).toBeUndefined();
  });

  it('should distinguish between similar FQNs', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    const userService = createSymbol('UserService', 'com.example.UserService');
    table.byFqn.set('com.example.User', user);
    table.byFqn.set('com.example.UserService', userService);

    expect(lookupSymbol(table, 'com.example.User')).toBe(user);
    expect(lookupSymbol(table, 'com.example.UserService')).toBe(userService);
  });

  it('should handle nested class FQNs', () => {
    const table = createEmptySymbolTable();
    const nested = createSymbol('Inner', 'com.example.Outer.Inner');
    table.byFqn.set('com.example.Outer.Inner', nested);

    expect(lookupSymbol(table, 'com.example.Outer.Inner')).toBe(nested);
    expect(lookupSymbol(table, 'com.example.Outer')).toBeUndefined();
  });
});
