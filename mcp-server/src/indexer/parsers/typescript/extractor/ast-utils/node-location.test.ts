import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { nodeLocation } from './node-location.js';
import { findChildByType } from './find-child-by-type.js';

describe('nodeLocation', () => {
  it('should return 1-based line numbers', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startLine).toBe(1);
    expect(location.endLine).toBe(1);
  });

  it('should return 1-based column numbers', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startColumn).toBe(1);
    expect(location.endColumn).toBe(14); // 'class User {}' is 13 chars
  });

  it('should handle multiline declarations', () => {
    const tree = parseTypeScript(
      `class User {
  name: string;
}`,
      '/test.ts'
    );
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startLine).toBe(1);
    expect(location.endLine).toBe(3);
  });

  it('should set filePath to empty string', () => {
    const tree = parseTypeScript('class User {}', '/test.ts');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.filePath).toBe('');
  });

  it('should handle indented code', () => {
    const tree = parseTypeScript(
      `
    class User {
        getName() {}
    }
`,
      '/test.ts'
    );
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDef = findChildByType(classBody!, 'method_definition');
    const methodLocation = nodeLocation(methodDef!);

    expect(methodLocation.startLine).toBe(3);
    expect(methodLocation.startColumn).toBe(9); // 8 spaces + 1 for 1-based
  });

  it('should handle function declarations', () => {
    const tree = parseTypeScript('function doSomething() {}', '/test.ts');
    const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
    const location = nodeLocation(funcDecl!);

    expect(location.startLine).toBe(1);
  });
});
