import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractFunction } from './extract-function.js';

function findFunctionDeclaration(source: string) {
  const tree = parseKotlin(source);
  let funcDecl: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'function_declaration' && !funcDecl) {
      funcDecl = node;
    }
  });
  return funcDecl;
}

describe('extractFunction', () => {
  describe('basic extraction', () => {
    it('should extract function name', () => {
      const node = findFunctionDeclaration('fun greet(): String = "Hello"');
      const func = extractFunction(node!);
      expect(func.name).toBe('greet');
    });

    it('should extract function with parameters', () => {
      const node = findFunctionDeclaration('fun add(a: Int, b: Int): Int = a + b');
      const func = extractFunction(node!);
      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0]?.name).toBe('a');
      expect(func.parameters[1]?.name).toBe('b');
    });

    it('should extract return type', () => {
      const node = findFunctionDeclaration('fun getUser(): User = User()');
      const func = extractFunction(node!);
      expect(func.returnType).toBe('User');
    });

    it('should extract nullable return type', () => {
      const node = findFunctionDeclaration('fun findUser(): User? = null');
      const func = extractFunction(node!);
      expect(func.returnType).toBe('User?');
    });
  });

  describe('visibility', () => {
    it('should default to public visibility', () => {
      const node = findFunctionDeclaration('fun publicFunc() {}');
      const func = extractFunction(node!);
      expect(func.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const node = findFunctionDeclaration('private fun privateFunc() {}');
      const func = extractFunction(node!);
      expect(func.visibility).toBe('private');
    });

    it('should extract internal visibility', () => {
      const node = findFunctionDeclaration('internal fun internalFunc() {}');
      const func = extractFunction(node!);
      expect(func.visibility).toBe('internal');
    });
  });

  describe('modifiers', () => {
    it('should extract suspend modifier', () => {
      const node = findFunctionDeclaration('suspend fun fetchData() {}');
      const func = extractFunction(node!);
      expect(func.isSuspend).toBe(true);
    });

    it('should extract inline modifier', () => {
      const node = findFunctionDeclaration('inline fun <T> run(block: () -> T): T = block()');
      const func = extractFunction(node!);
      expect(func.isInline).toBe(true);
    });

    it('should extract infix modifier', () => {
      const node = findFunctionDeclaration('infix fun Int.add(other: Int): Int = this + other');
      const func = extractFunction(node!);
      expect(func.isInfix).toBe(true);
    });

    it('should extract operator modifier', () => {
      const node = findFunctionDeclaration('operator fun plus(other: Int): Int = this + other');
      const func = extractFunction(node!);
      expect(func.isOperator).toBe(true);
    });

    it('should extract abstract modifier', () => {
      const node = findFunctionDeclaration('abstract fun process()');
      const func = extractFunction(node!);
      expect(func.isAbstract).toBe(true);
    });
  });

  describe('extension functions', () => {
    it('should detect extension function', () => {
      const node = findFunctionDeclaration('fun String.capitalize(): String = this.uppercase()');
      const func = extractFunction(node!);
      expect(func.isExtension).toBe(true);
    });

    it('should extract receiver type', () => {
      const node = findFunctionDeclaration('fun String.capitalize(): String = this.uppercase()');
      const func = extractFunction(node!);
      expect(func.receiverType).toBe('String');
    });

    it('should extract generic receiver type', () => {
      const node = findFunctionDeclaration('fun List<User>.findActive(): List<User> = filter { it.active }');
      const func = extractFunction(node!);
      expect(func.receiverType).toBe('List<User>');
    });
  });

  describe('type parameters', () => {
    it('should extract type parameter', () => {
      const node = findFunctionDeclaration('fun <T> identity(value: T): T = value');
      const func = extractFunction(node!);
      expect(func.typeParameters).toHaveLength(1);
      expect(func.typeParameters![0]?.name).toBe('T');
    });

    it('should extract multiple type parameters', () => {
      const node = findFunctionDeclaration('fun <K, V> create(): Pair<K, V> = TODO()');
      const func = extractFunction(node!);
      expect(func.typeParameters).toHaveLength(2);
    });
  });

  describe('annotations', () => {
    it('should extract function annotation', () => {
      const node = findFunctionDeclaration('@Deprecated("old") fun oldFunc() {}');
      const func = extractFunction(node!);
      expect(func.annotations.length).toBeGreaterThan(0);
      expect(func.annotations[0]?.name).toBe('Deprecated');
    });
  });

  describe('function calls', () => {
    it('should extract calls from function body', () => {
      const node = findFunctionDeclaration('fun process() { println("hello"); doWork() }');
      const func = extractFunction(node!);
      expect(func.calls.length).toBeGreaterThan(0);
    });
  });

  describe('location', () => {
    it('should include location information', () => {
      const node = findFunctionDeclaration('fun test() {}');
      const func = extractFunction(node!);
      expect(func.location).toBeDefined();
      expect(func.location.startLine).toBeGreaterThan(0);
    });
  });
});
