import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode, findNodeByType } from './traverse-node.js';

describe('traverseNode', () => {
  it('should visit all nodes', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited).toContain('program');
    expect(visited).toContain('class_declaration');
    expect(visited).toContain('type_identifier');
    expect(visited).toContain('class_body');
  });

  it('should visit nodes in depth-first order', () => {
    const tree = parseTypeScript('class User { name: string; }', '/test.ts');
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
    const tree = parseTypeScript(
      `
      class Outer {
        inner = class Inner {
          method() {}
        }
      }
    `,
      '/test.ts'
    );
    const nodeTypes: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'class_declaration' || node.type === 'class' || node.type === 'method_definition') {
        nodeTypes.push(node.type);
      }
    });

    expect(nodeTypes).toContain('class_declaration');
    expect(nodeTypes).toContain('class');
    expect(nodeTypes).toContain('method_definition');
  });

  it('should visit all children', () => {
    const tree = parseTypeScript('class Test { a: number; b: number; c: number; }', '/test.ts');
    let fieldCount = 0;

    traverseNode(tree.rootNode, (node) => {
      if (node.type === 'public_field_definition') {
        fieldCount++;
      }
    });

    expect(fieldCount).toBe(3);
  });

  it('should handle empty class', () => {
    const tree = parseTypeScript('class Empty {}', '/test.ts');
    const visited: string[] = [];

    traverseNode(tree.rootNode, (node) => {
      visited.push(node.type);
    });

    expect(visited).toContain('class_declaration');
    expect(visited).toContain('class_body');
  });
});

describe('findNodeByType', () => {
  it('should find first node of given type in tree', () => {
    const tree = parseTypeScript('class User { name: string; }', '/test.ts');
    const fieldDef = findNodeByType(tree.rootNode, 'public_field_definition');

    expect(fieldDef).toBeDefined();
    expect(fieldDef!.type).toBe('public_field_definition');
  });

  it('should return undefined if type not found', () => {
    const tree = parseTypeScript('const x = 1;', '/test.ts');
    const classDecl = findNodeByType(tree.rootNode, 'class_declaration');

    expect(classDecl).toBeUndefined();
  });

  it('should find deeply nested node', () => {
    const tree = parseTypeScript(
      `
      class Outer {
        method() {
          const x = 1;
        }
      }
    `,
      '/test.ts'
    );
    const lexicalDecl = findNodeByType(tree.rootNode, 'lexical_declaration');

    expect(lexicalDecl).toBeDefined();
    expect(lexicalDecl!.type).toBe('lexical_declaration');
  });
});
