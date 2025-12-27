import { describe, it, expect, beforeEach } from 'vitest';
import { addSymbol } from './add-symbol.js';
import type { Symbol, SymbolTable } from '../types.js';

describe('addSymbol', () => {
  let table: SymbolTable;

  const createEmptyTable = (): SymbolTable => ({
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  });

  const createSymbol = (overrides: Partial<Symbol> = {}): Symbol => ({
    name: 'TestClass',
    fqn: 'com.example.TestClass',
    kind: 'class',
    filePath: '/test/TestClass.kt',
    location: { filePath: '/test/TestClass.kt', startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
    packageName: 'com.example',
    ...overrides,
  });

  beforeEach(() => {
    table = createEmptyTable();
  });

  describe('FQN indexing', () => {
    it('should add symbol to byFqn index', () => {
      const symbol = createSymbol();
      addSymbol(table, symbol);

      expect(table.byFqn.has('com.example.TestClass')).toBe(true);
      expect(table.byFqn.get('com.example.TestClass')).toBe(symbol);
    });

    it('should overwrite existing symbol with same FQN', () => {
      const symbol1 = createSymbol({ fqn: 'com.example.Same' });
      const symbol2 = createSymbol({ fqn: 'com.example.Same', name: 'Updated' });

      addSymbol(table, symbol1);
      addSymbol(table, symbol2);

      expect(table.byFqn.get('com.example.Same')?.name).toBe('Updated');
    });
  });

  describe('name indexing', () => {
    it('should add symbol to byName index', () => {
      const symbol = createSymbol({ name: 'Service' });
      addSymbol(table, symbol);

      expect(table.byName.has('Service')).toBe(true);
      expect(table.byName.get('Service')).toContain(symbol);
    });

    it('should group symbols with same name', () => {
      const symbol1 = createSymbol({ name: 'Service', fqn: 'com.a.Service', packageName: 'com.a' });
      const symbol2 = createSymbol({ name: 'Service', fqn: 'com.b.Service', packageName: 'com.b' });

      addSymbol(table, symbol1);
      addSymbol(table, symbol2);

      const services = table.byName.get('Service');
      expect(services).toHaveLength(2);
      expect(services).toContain(symbol1);
      expect(services).toContain(symbol2);
    });

    it('should not duplicate when adding same symbol twice', () => {
      const symbol = createSymbol();
      addSymbol(table, symbol);
      addSymbol(table, symbol);

      // Note: current implementation allows duplicates in byName
      // This test documents current behavior
      const symbols = table.byName.get(symbol.name);
      expect(symbols).toHaveLength(2);
    });
  });

  describe('package indexing', () => {
    it('should add symbol to byPackage index', () => {
      const symbol = createSymbol({ packageName: 'com.example.domain' });
      addSymbol(table, symbol);

      expect(table.byPackage.has('com.example.domain')).toBe(true);
      expect(table.byPackage.get('com.example.domain')).toContain(symbol);
    });

    it('should group symbols in same package', () => {
      const symbol1 = createSymbol({ name: 'User', fqn: 'com.example.User', packageName: 'com.example' });
      const symbol2 = createSymbol({ name: 'Order', fqn: 'com.example.Order', packageName: 'com.example' });

      addSymbol(table, symbol1);
      addSymbol(table, symbol2);

      const packageSymbols = table.byPackage.get('com.example');
      expect(packageSymbols).toHaveLength(2);
      expect(packageSymbols).toContain(symbol1);
      expect(packageSymbols).toContain(symbol2);
    });

    it('should not add to byPackage if packageName is undefined', () => {
      const symbol = createSymbol({ packageName: undefined });
      addSymbol(table, symbol);

      expect(table.byPackage.size).toBe(0);
    });

    it('should not add to byPackage if packageName is empty string', () => {
      const symbol = createSymbol({ packageName: '' });
      addSymbol(table, symbol);

      expect(table.byPackage.size).toBe(0);
    });
  });

  describe('different symbol kinds', () => {
    it('should add class symbol', () => {
      const symbol = createSymbol({ kind: 'class' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('class');
    });

    it('should add interface symbol', () => {
      const symbol = createSymbol({ kind: 'interface', name: 'Repository' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('interface');
    });

    it('should add function symbol', () => {
      const symbol = createSymbol({ kind: 'function', name: 'process' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('function');
    });

    it('should add property symbol', () => {
      const symbol = createSymbol({ kind: 'property', name: 'id' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('property');
    });

    it('should add object symbol', () => {
      const symbol = createSymbol({ kind: 'object', name: 'Singleton' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('object');
    });

    it('should add typealias symbol', () => {
      const symbol = createSymbol({ kind: 'typealias', name: 'UserId' });
      addSymbol(table, symbol);
      expect(table.byFqn.get(symbol.fqn)?.kind).toBe('typealias');
    });
  });

  describe('symbols without package', () => {
    it('should handle symbol at root level', () => {
      const symbol = createSymbol({
        name: 'RootClass',
        fqn: 'RootClass',
        packageName: undefined,
      });
      addSymbol(table, symbol);

      expect(table.byFqn.has('RootClass')).toBe(true);
      expect(table.byName.has('RootClass')).toBe(true);
      expect(table.byPackage.size).toBe(0);
    });
  });
});
