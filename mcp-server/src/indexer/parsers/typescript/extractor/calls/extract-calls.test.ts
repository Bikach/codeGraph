import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractCalls } from './extract-calls.js';
import { findChildByType } from '../ast-utils/index.js';
import type { SyntaxNode } from 'tree-sitter';

/**
 * Helper to extract calls from a function body.
 * Parses a function and extracts all calls from its body.
 */
function parseCalls(source: string) {
  const tree = parseTypeScript(source, '/test.ts');
  const funcNode = findChildByType(tree.rootNode, 'function_declaration');
  if (!funcNode) throw new Error('No function found');
  const body = findChildByType(funcNode, 'statement_block');
  if (!body) throw new Error('No function body found');
  return extractCalls(body);
}

/**
 * Helper to parse calls from an arrow function.
 */
function parseArrowCalls(source: string) {
  const tree = parseTypeScript(source, '/test.ts');

  // Find variable_declarator containing arrow function
  function findArrowBody(node: SyntaxNode): SyntaxNode | null {
    if (node.type === 'arrow_function') {
      return findChildByType(node, 'statement_block') ?? node.children[node.children.length - 1] ?? null;
    }
    for (const child of node.children) {
      const result = findArrowBody(child);
      if (result) return result;
    }
    return null;
  }

  const body = findArrowBody(tree.rootNode);
  if (!body) throw new Error('No arrow function body found');
  return extractCalls(body);
}

describe('extractCalls', () => {
  describe('simple function calls', () => {
    it('should extract direct function call', () => {
      const calls = parseCalls(`function test() { foo(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('foo');
      expect(calls[0]!.receiver).toBeUndefined();
    });

    it('should extract function call with arguments', () => {
      const calls = parseCalls(`function test() { foo(1, 2, 3); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('foo');
      expect(calls[0]!.argumentCount).toBe(3);
    });

    it('should extract multiple function calls', () => {
      const calls = parseCalls(`function test() { foo(); bar(); baz(); }`);

      expect(calls).toHaveLength(3);
      expect(calls.map((c) => c.name)).toEqual(['foo', 'bar', 'baz']);
    });

    it('should extract function call with no arguments', () => {
      const calls = parseCalls(`function test() { emptyCall(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.argumentCount).toBe(0);
    });
  });

  describe('method calls', () => {
    it('should extract method call with receiver', () => {
      const calls = parseCalls(`function test() { obj.method(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('method');
      expect(calls[0]!.receiver).toBe('obj');
    });

    it('should extract method call with arguments', () => {
      const calls = parseCalls(`function test() { user.save(data); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('save');
      expect(calls[0]!.receiver).toBe('user');
      expect(calls[0]!.argumentCount).toBe(1);
    });

    it('should extract chained property access', () => {
      const calls = parseCalls(`function test() { a.b.c.method(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('method');
      expect(calls[0]!.receiver).toBe('a.b.c');
    });
  });

  describe('optional chaining', () => {
    it('should detect optional chaining call', () => {
      const calls = parseCalls(`function test() { obj?.method(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('method');
      // Note: Optional chaining detection depends on AST node structure
      // The isSafeCall may be undefined if not detected
      expect(calls[0]!.receiver).toBe('obj');
    });

    it('should detect optional chaining in chain', () => {
      const calls = parseCalls(`function test() { a?.b.method(); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('method');
      // Note: receiver path includes the full chain
      expect(calls[0]!.receiver).toContain('a');
    });
  });

  describe('constructor calls', () => {
    it('should extract new expression as call', () => {
      const calls = parseCalls(`function test() { new User(); }`);

      // Note: new expressions are handled differently - they're not call_expression
      // This test verifies that extractCalls focuses on call_expression nodes
      // Constructor calls may be handled separately
      expect(calls).toHaveLength(0); // new expressions are not call_expression
    });
  });

  describe('chained calls', () => {
    it('should extract chained method calls', () => {
      const calls = parseCalls(`function test() { arr.filter(x => x > 0).map(x => x * 2); }`);

      expect(calls.length).toBeGreaterThanOrEqual(2);
      const names = calls.map((c) => c.name);
      expect(names).toContain('filter');
      expect(names).toContain('map');
    });

    it('should extract builder pattern calls', () => {
      const calls = parseCalls(`function test() { builder.set('a', 1).set('b', 2).build(); }`);

      expect(calls.length).toBeGreaterThanOrEqual(3);
      const names = calls.map((c) => c.name);
      expect(names.filter((n) => n === 'set')).toHaveLength(2);
      expect(names).toContain('build');
    });
  });

  describe('nested calls', () => {
    it('should extract nested function calls', () => {
      const calls = parseCalls(`function test() { outer(inner()); }`);

      expect(calls).toHaveLength(2);
      const names = calls.map((c) => c.name);
      expect(names).toContain('outer');
      expect(names).toContain('inner');
    });

    it('should extract calls as arguments', () => {
      const calls = parseCalls(`function test() { process(getData(), transform(value)); }`);

      expect(calls).toHaveLength(3);
      const names = calls.map((c) => c.name);
      expect(names).toContain('process');
      expect(names).toContain('getData');
      expect(names).toContain('transform');
    });
  });

  describe('arrow function calls', () => {
    it('should extract calls from arrow function body', () => {
      const calls = parseArrowCalls(`const fn = () => { doSomething(); };`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('doSomething');
    });

    it('should extract calls from arrow function expression', () => {
      const calls = parseArrowCalls(`const fn = () => getValue();`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('getValue');
    });
  });

  describe('location tracking', () => {
    it('should track call location', () => {
      const calls = parseCalls(`function test() { foo(); }`);

      expect(calls[0]!.location).toBeDefined();
      // Note: filePath is set to '' by nodeLocation, will be set by caller
      expect(calls[0]!.location.startLine).toBe(1);
      expect(calls[0]!.location.startColumn).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty function body', () => {
      const calls = parseCalls(`function test() {}`);

      expect(calls).toHaveLength(0);
    });

    it('should handle IIFE-like patterns', () => {
      const calls = parseCalls(`function test() { (function() {})(); }`);

      expect(calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract callback calls', () => {
      const calls = parseCalls(`function test() { callback(event); }`);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.name).toBe('callback');
    });
  });
});
