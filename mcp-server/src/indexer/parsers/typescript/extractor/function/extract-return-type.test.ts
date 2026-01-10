import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractReturnType } from './extract-return-type.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Helper to parse and extract return type from a function.
 */
function parseReturnType(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const funcNode = findChildByType(tree.rootNode, 'function_declaration');
  if (!funcNode) throw new Error('No function found');
  return extractReturnType(funcNode);
}

/**
 * Helper to parse and extract return type from a method.
 */
function parseMethodReturnType(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const classNode = findChildByType(tree.rootNode, 'class_declaration');
  if (!classNode) throw new Error('No class found');
  const classBody = findChildByType(classNode, 'class_body');
  if (!classBody) throw new Error('No class body found');
  const methodNode = findChildByType(classBody, 'method_definition');
  if (!methodNode) throw new Error('No method found');
  return extractReturnType(methodNode);
}

describe('extractReturnType', () => {
  describe('function return types', () => {
    it('should return undefined for function without return type', () => {
      const returnType = parseReturnType(`function getData() {}`);
      expect(returnType).toBeUndefined();
    });

    it('should extract simple return type', () => {
      const returnType = parseReturnType(`function getData(): string {}`);
      expect(returnType).toBe('string');
    });

    it('should extract number return type', () => {
      const returnType = parseReturnType(`function getCount(): number {}`);
      expect(returnType).toBe('number');
    });

    it('should extract boolean return type', () => {
      const returnType = parseReturnType(`function isValid(): boolean {}`);
      expect(returnType).toBe('boolean');
    });

    it('should extract void return type', () => {
      const returnType = parseReturnType(`function doSomething(): void {}`);
      expect(returnType).toBe('void');
    });

    it('should extract array return type', () => {
      const returnType = parseReturnType(`function getItems(): string[] {}`);
      expect(returnType).toBe('string[]');
    });

    it('should extract generic return type', () => {
      const returnType = parseReturnType(`function getData(): Promise<string> {}`);
      expect(returnType).toBe('Promise<string>');
    });

    it('should extract union return type', () => {
      const returnType = parseReturnType(`function getData(): string | null {}`);
      expect(returnType).toBe('string | null');
    });

    it('should extract intersection return type', () => {
      const returnType = parseReturnType(`function merge(): A & B {}`);
      expect(returnType).toBe('A & B');
    });

    it('should extract complex generic return type', () => {
      const returnType = parseReturnType(`function getData(): Map<string, User[]> {}`);
      expect(returnType).toBe('Map<string, User[]>');
    });

    it('should extract object return type', () => {
      const returnType = parseReturnType(`function getConfig(): { timeout: number } {}`);
      expect(returnType).toBe('{ timeout: number }');
    });

    it('should extract function return type', () => {
      const returnType = parseReturnType(`function createHandler(): (x: number) => void {}`);
      expect(returnType).toBe('(x: number) => void');
    });
  });

  describe('method return types', () => {
    it('should extract method return type', () => {
      const returnType = parseMethodReturnType(`
        class Service {
          getData(): string { return ''; }
        }
      `);
      expect(returnType).toBe('string');
    });

    it('should extract async method return type', () => {
      const returnType = parseMethodReturnType(`
        class Service {
          async fetchData(): Promise<Data> { return null; }
        }
      `);
      expect(returnType).toBe('Promise<Data>');
    });

    it('should return undefined for method without return type', () => {
      const returnType = parseMethodReturnType(`
        class Service {
          getData() { return ''; }
        }
      `);
      expect(returnType).toBeUndefined();
    });
  });
});
