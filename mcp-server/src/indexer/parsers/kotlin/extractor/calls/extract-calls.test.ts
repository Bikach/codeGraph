import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractCalls } from './extract-calls.js';

function findFunctionBody(source: string) {
  const tree = parseKotlin(source);
  let body: import('tree-sitter').SyntaxNode | undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'function_body' && !body) {
      body = node;
    }
  });
  return body;
}

describe('extractCalls', () => {
  it('should extract simple function call', () => {
    const body = findFunctionBody('fun test() { println("hello") }');
    const calls = extractCalls(body!);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.find(c => c.name === 'println')).toBeDefined();
  });

  it('should extract multiple calls', () => {
    const body = findFunctionBody('fun test() { first(); second(); third() }');
    const calls = extractCalls(body!);
    expect(calls.length).toBe(3);
  });

  it('should extract method call with receiver', () => {
    const body = findFunctionBody('fun test() { repo.save(data) }');
    const calls = extractCalls(body!);
    const saveCall = calls.find(c => c.name === 'save');
    expect(saveCall).toBeDefined();
    expect(saveCall?.receiver).toBe('repo');
  });

  it('should extract chained calls', () => {
    const body = findFunctionBody('fun test() { list.filter { it > 0 }.map { it * 2 } }');
    const calls = extractCalls(body!);
    expect(calls.find(c => c.name === 'filter')).toBeDefined();
    expect(calls.find(c => c.name === 'map')).toBeDefined();
  });

  it('should extract nested calls', () => {
    const body = findFunctionBody('fun test() { outer(inner(1)) }');
    const calls = extractCalls(body!);
    expect(calls.find(c => c.name === 'outer')).toBeDefined();
    expect(calls.find(c => c.name === 'inner')).toBeDefined();
  });

  it('should return empty array for empty body', () => {
    const body = findFunctionBody('fun test() {}');
    const calls = extractCalls(body!);
    expect(calls).toEqual([]);
  });
});
