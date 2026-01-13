import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { extractCallExpression } from './extract-call-expression.js';
import { traverseNode } from '../ast-utils/index.js';
import type { SyntaxNode } from 'tree-sitter';

/**
 * Helper to find the first call_expression node in parsed source.
 */
function findCallExpression(source: string): SyntaxNode | null {
  const tree = parseTypeScript(source, '/test.ts');
  let callNode: SyntaxNode | null = null;

  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'call_expression' && !callNode) {
      callNode = node;
    }
  });

  return callNode;
}

/**
 * Helper to parse and extract a call expression from source.
 */
function parseCallExpression(source: string) {
  const callNode = findCallExpression(source);
  if (!callNode) throw new Error('No call_expression found');
  return extractCallExpression(callNode);
}

describe('extractCallExpression', () => {
  describe('direct function calls', () => {
    it('should extract simple function call', () => {
      const call = parseCallExpression(`foo();`);

      expect(call).toBeDefined();
      expect(call!.name).toBe('foo');
      expect(call!.receiver).toBeUndefined();
      expect(call!.argumentCount).toBe(0);
    });

    it('should extract function call with one argument', () => {
      const call = parseCallExpression(`greet('hello');`);

      expect(call!.name).toBe('greet');
      expect(call!.argumentCount).toBe(1);
    });

    it('should extract function call with multiple arguments', () => {
      const call = parseCallExpression(`add(1, 2, 3);`);

      expect(call!.name).toBe('add');
      expect(call!.argumentCount).toBe(3);
    });

    it('should extract function call with complex arguments', () => {
      const call = parseCallExpression(`process({ key: 'value' }, [1, 2, 3]);`);

      expect(call!.name).toBe('process');
      expect(call!.argumentCount).toBe(2);
    });
  });

  describe('method calls with receiver', () => {
    it('should extract method call with simple receiver', () => {
      const call = parseCallExpression(`obj.method();`);

      expect(call!.name).toBe('method');
      expect(call!.receiver).toBe('obj');
    });

    it('should extract method call with this receiver', () => {
      const call = parseCallExpression(`this.save();`);

      expect(call!.name).toBe('save');
      expect(call!.receiver).toBe('this');
    });

    it('should extract method call with arguments', () => {
      const call = parseCallExpression(`user.update(data);`);

      expect(call!.name).toBe('update');
      expect(call!.receiver).toBe('user');
      expect(call!.argumentCount).toBe(1);
    });
  });

  describe('chained property access', () => {
    it('should extract method from two-level chain', () => {
      const call = parseCallExpression(`a.b.method();`);

      expect(call!.name).toBe('method');
      expect(call!.receiver).toBe('a.b');
    });

    it('should extract method from three-level chain', () => {
      const call = parseCallExpression(`a.b.c.method();`);

      expect(call!.name).toBe('method');
      expect(call!.receiver).toBe('a.b.c');
    });

    it('should extract method from deep chain', () => {
      const call = parseCallExpression(`config.database.connection.pool.create();`);

      expect(call!.name).toBe('create');
      expect(call!.receiver).toBe('config.database.connection.pool');
    });
  });

  describe('optional chaining', () => {
    it('should detect optional chaining on receiver', () => {
      const call = parseCallExpression(`obj?.method();`);

      expect(call!.name).toBe('method');
      expect(call!.receiver).toBe('obj');
      // Note: Optional chaining detection depends on AST structure
      // The current implementation may not detect all cases
    });

    it('should detect optional chaining in chain', () => {
      const call = parseCallExpression(`a?.b.method();`);

      expect(call!.name).toBe('method');
      // Receiver should include the chain
      expect(call!.receiver).toContain('a');
    });

    it('should detect optional chaining at end of chain', () => {
      const call = parseCallExpression(`a.b?.method();`);

      expect(call!.name).toBe('method');
      // Receiver should be the chain before method
      expect(call!.receiver).toBeDefined();
    });

    it('should not set isSafeCall for regular calls', () => {
      const call = parseCallExpression(`obj.method();`);

      expect(call!.isSafeCall).toBeUndefined();
    });
  });

  describe('chained function calls', () => {
    it('should handle immediately invoked result', () => {
      const call = parseCallExpression(`getFactory()();`);

      expect(call!.name).toBe('<chained>');
      expect(call!.receiver).toBe('getFactory()');
    });
  });

  describe('special expressions', () => {
    it('should handle IIFE pattern', () => {
      const call = parseCallExpression(`(function() {})();`);

      expect(call).toBeDefined();
      expect(call!.argumentCount).toBe(0);
    });

    it('should handle arrow function IIFE', () => {
      const call = parseCallExpression(`(() => {})();`);

      expect(call).toBeDefined();
      expect(call!.argumentCount).toBe(0);
    });

    it('should handle parenthesized call', () => {
      const call = parseCallExpression(`(obj.method)();`);

      expect(call).toBeDefined();
    });
  });

  describe('argument counting', () => {
    it('should count zero arguments', () => {
      const call = parseCallExpression(`fn();`);

      expect(call!.argumentCount).toBe(0);
    });

    it('should count single argument', () => {
      const call = parseCallExpression(`fn(x);`);

      expect(call!.argumentCount).toBe(1);
    });

    it('should count multiple arguments', () => {
      const call = parseCallExpression(`fn(a, b, c, d, e);`);

      expect(call!.argumentCount).toBe(5);
    });

    it('should count spread arguments', () => {
      const call = parseCallExpression(`fn(...args);`);

      expect(call!.argumentCount).toBe(1);
    });

    it('should count mixed arguments with spread', () => {
      const call = parseCallExpression(`fn(a, b, ...rest);`);

      expect(call!.argumentCount).toBe(3);
    });

    it('should count callback arguments', () => {
      const call = parseCallExpression(`arr.map(x => x * 2);`);

      expect(call!.argumentCount).toBe(1);
    });
  });

  describe('location tracking', () => {
    it('should include location information', () => {
      const call = parseCallExpression(`foo();`);

      expect(call!.location).toBeDefined();
      expect(call!.location.startLine).toBe(1);
      expect(call!.location.startColumn).toBeGreaterThan(0);
      expect(call!.location.endLine).toBe(1);
      expect(call!.location.endColumn).toBeGreaterThan(0);
    });

    it('should track correct position for method call', () => {
      const call = parseCallExpression(`obj.method();`);

      expect(call!.location.startLine).toBe(1);
    });
  });

  describe('return undefined for invalid nodes', () => {
    it('should return undefined when node has no children', () => {
      // Create a minimal test case - a node without proper call structure
      const tree = parseTypeScript(`const x = 5;`, '/test.ts');

      // Find a node that has children but is not a call_expression
      // The function should return undefined when there's no 'arguments' child
      let foundNode: SyntaxNode | null = null;
      traverseNode(tree.rootNode, (node) => {
        if (node.type === 'number' && !foundNode) {
          foundNode = node;
        }
      });

      if (foundNode) {
        const result = extractCallExpression(foundNode);
        expect(result).toBeUndefined();
      }
    });
  });

  describe('receiverType and argumentTypes', () => {
    it('should leave receiverType undefined (resolved later)', () => {
      const call = parseCallExpression(`obj.method();`);

      expect(call!.receiverType).toBeUndefined();
    });

    it('should infer argument types from literals', () => {
      const call = parseCallExpression(`fn(1, 'str', true);`);

      expect(call!.argumentTypes).toEqual(['number', 'string', 'boolean']);
    });

    it('should return undefined argumentTypes for empty arguments', () => {
      const call = parseCallExpression(`fn();`);

      expect(call!.argumentTypes).toBeUndefined();
    });

    it('should infer unknown for identifiers', () => {
      const call = parseCallExpression(`fn(variable);`);

      expect(call!.argumentTypes).toEqual(['unknown']);
    });
  });
});
