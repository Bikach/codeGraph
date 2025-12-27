import { describe, it, expect } from 'vitest';
import { findSymbols } from './find-symbols.js';
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

function populateTable(table: SymbolTable, symbols: Symbol[]): void {
  for (const symbol of symbols) {
    table.byFqn.set(symbol.fqn, symbol);
  }
}

describe('findSymbols', () => {
  it('should return empty array for empty table', () => {
    const table = createEmptySymbolTable();
    expect(findSymbols(table, '*')).toEqual([]);
  });

  it('should find symbol by exact name', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    populateTable(table, [user]);

    const results = findSymbols(table, 'User');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(user);
  });

  it('should find symbol by exact FQN', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    populateTable(table, [user]);

    const results = findSymbols(table, 'com.example.User');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(user);
  });

  it('should find symbols by name pattern with wildcard', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    const userService = createSymbol('UserService', 'com.example.UserService');
    const userRepository = createSymbol('UserRepository', 'com.example.UserRepository');
    const admin = createSymbol('Admin', 'com.example.Admin');
    populateTable(table, [user, userService, userRepository, admin]);

    const results = findSymbols(table, 'User*');
    expect(results).toHaveLength(3);
    expect(results.map((s) => s.name).sort()).toEqual(['User', 'UserRepository', 'UserService']);
  });

  it('should find symbols by FQN pattern with wildcard', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.domain.User');
    const admin = createSymbol('Admin', 'com.example.domain.Admin');
    const service = createSymbol('Service', 'com.example.service.Service');
    populateTable(table, [user, admin, service]);

    const results = findSymbols(table, 'com.example.domain.*');
    expect(results).toHaveLength(2);
    expect(results.map((s) => s.name).sort()).toEqual(['Admin', 'User']);
  });

  it('should find symbols with wildcard in middle of pattern', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    const admin = createSymbol('Admin', 'com.other.Admin');
    populateTable(table, [user, admin]);

    const results = findSymbols(table, 'com.*.User');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('User');
  });

  it('should find all symbols with * pattern', () => {
    const table = createEmptySymbolTable();
    const symbols = [
      createSymbol('User', 'com.example.User'),
      createSymbol('Admin', 'com.example.Admin'),
      createSymbol('Service', 'com.example.Service'),
    ];
    populateTable(table, symbols);

    const results = findSymbols(table, '*');
    expect(results).toHaveLength(3);
  });

  it('should return empty array when no match', () => {
    const table = createEmptySymbolTable();
    const user = createSymbol('User', 'com.example.User');
    populateTable(table, [user]);

    expect(findSymbols(table, 'NonExistent')).toEqual([]);
    expect(findSymbols(table, 'com.other.*')).toEqual([]);
  });

  it('should find symbols ending with pattern', () => {
    const table = createEmptySymbolTable();
    const userService = createSymbol('UserService', 'com.example.UserService');
    const adminService = createSymbol('AdminService', 'com.example.AdminService');
    const user = createSymbol('User', 'com.example.User');
    populateTable(table, [userService, adminService, user]);

    const results = findSymbols(table, '*Service');
    expect(results).toHaveLength(2);
    expect(results.map((s) => s.name).sort()).toEqual(['AdminService', 'UserService']);
  });
});
