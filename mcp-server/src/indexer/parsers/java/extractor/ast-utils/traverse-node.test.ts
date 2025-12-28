import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { traverseNode } from './traverse-node.js';

describe('traverseNode', () => {
  it('should visit all nodes', () => {
    const tree = parseJava('class User {}');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited).toContain('program');
    expect(visited).toContain('class_declaration');
    expect(visited).toContain('identifier');
    expect(visited).toContain('class_body');
  });

  it('should visit nodes in depth-first order', () => {
    const tree = parseJava('class User { String name; }');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    // class_declaration should come before its children
    const classIndex = visited.indexOf('class_declaration');
    const bodyIndex = visited.indexOf('class_body');
    expect(classIndex).toBeLessThan(bodyIndex);
  });

  it('should handle nested structures', () => {
    const tree = parseJava(`
      class Outer {
        class Inner {
          void method() {}
        }
      }
    `);
    const nodeTypes: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'class_declaration' || node.type === 'method_declaration') {
        nodeTypes.push(node.type);
      }
    });

    expect(nodeTypes).toEqual(['class_declaration', 'class_declaration', 'method_declaration']);
  });

  it('should visit all children', () => {
    const tree = parseJava('class Test { int a; int b; int c; }');
    let fieldCount = 0;

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'field_declaration') {
        fieldCount++;
      }
    });

    expect(fieldCount).toBe(3);
  });

  it('should handle empty class', () => {
    const tree = parseJava('class Empty {}');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited).toContain('class_declaration');
    expect(visited).toContain('class_body');
  });
});
