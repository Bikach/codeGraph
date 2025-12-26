import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { traverseNode } from './traverse-node.js';

describe('traverseNode', () => {
  it('should visit all nodes in the tree', () => {
    const tree = parseKotlin('class User');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited.length).toBeGreaterThan(0);
    expect(visited).toContain('source_file');
    expect(visited).toContain('class_declaration');
  });

  it('should visit nodes in depth-first order', () => {
    const tree = parseKotlin(`
      class User {
        fun getName(): String = "test"
      }
    `);
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    // Parent should come before children
    const classIndex = visited.indexOf('class_declaration');
    const bodyIndex = visited.indexOf('class_body');
    const funcIndex = visited.indexOf('function_declaration');

    expect(classIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(funcIndex);
  });

  it('should visit all call_expression nodes', () => {
    const tree = parseKotlin(`
      fun test() {
        println("hello")
        doSomething()
        obj.method()
      }
    `);
    const callExpressions: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'call_expression') {
        callExpressions.push(node.text);
      }
    });

    expect(callExpressions.length).toBe(3);
  });

  it('should allow early termination via callback side effects', () => {
    const tree = parseKotlin('class A\nclass B\nclass C');
    const visited: string[] = [];
    let count = 0;

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'class_declaration') {
        count++;
        visited.push(node.type);
      }
    });

    expect(count).toBe(3);
  });

  it('should handle empty class body', () => {
    const tree = parseKotlin('class Empty {}');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited).toContain('class_body');
  });
});
