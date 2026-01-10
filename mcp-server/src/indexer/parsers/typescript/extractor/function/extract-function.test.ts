import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractFunction, extractMethod } from './extract-function.js';
import type { SyntaxNode } from 'tree-sitter';

function findFunctionDeclaration(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let funcDecl: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'function_declaration' && !funcDecl) {
      funcDecl = node;
    }
  });
  return funcDecl;
}

function findMethodDefinition(source: string): SyntaxNode | undefined {
  const tree = parseTypeScript(source, 'test.ts');
  let methodDef: SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if ((node.type === 'method_definition' || node.type === 'abstract_method_signature') && !methodDef) {
      methodDef = node;
    }
  });
  return methodDef;
}

describe('extractFunction', () => {
  describe('basic extraction', () => {
    it('should extract function name', () => {
      const node = findFunctionDeclaration('function greet() {}');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.name).toBe('greet');
    });

    it('should extract function with parameters', () => {
      const node = findFunctionDeclaration('function add(a: number, b: number) { return a + b; }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0]?.name).toBe('a');
      expect(func.parameters[0]?.type).toBe('number');
      expect(func.parameters[1]?.name).toBe('b');
      expect(func.parameters[1]?.type).toBe('number');
    });

    it('should extract return type', () => {
      const node = findFunctionDeclaration('function getUser(): User { return new User(); }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.returnType).toBe('User');
    });

    it('should extract union return type', () => {
      const node = findFunctionDeclaration('function getValue(): string | number { return "test"; }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.returnType).toBe('string | number');
    });

    it('should handle function without return type', () => {
      const node = findFunctionDeclaration('function noReturn() { console.log("hi"); }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.returnType).toBeUndefined();
    });
  });

  describe('async functions', () => {
    it('should detect async function', () => {
      const node = findFunctionDeclaration('async function fetchData() {}');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.isSuspend).toBe(true);
    });

    it('should extract async function with return type', () => {
      const node = findFunctionDeclaration('async function fetchData(): Promise<User> { return new User(); }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.isSuspend).toBe(true);
      expect(func.returnType).toBe('Promise<User>');
    });
  });

  describe('generic functions', () => {
    it('should extract type parameter', () => {
      const node = findFunctionDeclaration('function identity<T>(value: T): T { return value; }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.typeParameters).toHaveLength(1);
      expect(func.typeParameters![0]?.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = findFunctionDeclaration('function pair<K, V>(key: K, value: V): [K, V] { return [key, value]; }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.typeParameters).toHaveLength(2);
      expect(func.typeParameters![0]?.name).toBe('K');
      expect(func.typeParameters![1]?.name).toBe('V');
    });

    it('should extract type parameter with constraint', () => {
      const node = findFunctionDeclaration('function process<T extends Base>(item: T): void {}');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.typeParameters).toHaveLength(1);
      expect(func.typeParameters![0]?.name).toBe('T');
      expect(func.typeParameters![0]?.bounds).toContain('Base');
    });
  });

  describe('function calls extraction', () => {
    it('should extract calls from function body', () => {
      const node = findFunctionDeclaration('function process() { console.log("hello"); doWork(); }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.calls.length).toBeGreaterThan(0);
    });

    it('should extract member expression calls', () => {
      const node = findFunctionDeclaration('function process() { this.helper.doSomething(); }');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.calls.length).toBeGreaterThan(0);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findFunctionDeclaration('function test() {}');
      expect(node).toBeDefined();
      const func = extractFunction(node!);
      expect(func.location).toBeDefined();
      expect(func.location.startLine).toBeGreaterThan(0);
    });
  });
});

describe('extractMethod', () => {
  describe('basic extraction', () => {
    it('should extract method name', () => {
      const node = findMethodDefinition('class Foo { greet() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.name).toBe('greet');
    });

    it('should extract method with parameters', () => {
      const node = findMethodDefinition('class Foo { add(a: number, b: number): number { return a + b; } }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.parameters).toHaveLength(2);
      expect(method.parameters[0]?.name).toBe('a');
    });

    it('should extract method return type', () => {
      const node = findMethodDefinition('class Foo { getValue(): string { return "test"; } }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.returnType).toBe('string');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const node = findMethodDefinition('class Foo { publicMethod() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findMethodDefinition('class Foo { private privateMethod() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const node = findMethodDefinition('class Foo { protected protectedMethod() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.visibility).toBe('protected');
    });

    it('should detect private field method (#methodName)', () => {
      const node = findMethodDefinition('class Foo { #privateMethod() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.visibility).toBe('private');
      expect(method.name).toBe('privateMethod'); // # prefix removed
    });
  });

  describe('async methods', () => {
    it('should detect async method', () => {
      const node = findMethodDefinition('class Foo { async fetchData() {} }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.isSuspend).toBe(true);
    });
  });

  describe('abstract methods', () => {
    it('should detect abstract method', () => {
      const node = findMethodDefinition('abstract class Foo { abstract process(): void; }');
      expect(node).toBeDefined();
      const method = extractMethod(node!);
      expect(method.isAbstract).toBe(true);
    });
  });
});
