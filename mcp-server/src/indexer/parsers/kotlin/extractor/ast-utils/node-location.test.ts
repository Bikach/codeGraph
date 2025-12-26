import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { nodeLocation } from './node-location.js';
import { findChildByType } from './find-child-by-type.js';

describe('nodeLocation', () => {
  it('should return 1-based line numbers', () => {
    const tree = parseKotlin('class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startLine).toBe(1);
    expect(location.endLine).toBe(1);
  });

  it('should return 1-based column numbers', () => {
    const tree = parseKotlin('class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startColumn).toBe(1);
    // 'class User' is 10 characters, so end column should be 11 (1-based, exclusive)
    expect(location.endColumn).toBe(11);
  });

  it('should handle multiline declarations', () => {
    const tree = parseKotlin(`class User {
  val name: String = ""
}`);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.startLine).toBe(1);
    expect(location.endLine).toBe(3);
  });

  it('should set filePath to empty string', () => {
    const tree = parseKotlin('class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const location = nodeLocation(classDecl!);

    expect(location.filePath).toBe('');
  });

  it('should handle indented code', () => {
    const tree = parseKotlin(`
    class User {
        fun getName() = "test"
    }
`);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const funcDecl = findChildByType(classBody!, 'function_declaration');
    const funcLocation = nodeLocation(funcDecl!);

    // Function is on line 3 (1-indexed), indented by 8 spaces
    expect(funcLocation.startLine).toBe(3);
    expect(funcLocation.startColumn).toBe(9); // 8 spaces + 1 for 1-based
  });

  it('should handle function declarations', () => {
    const tree = parseKotlin('fun doSomething(): Unit {}');
    const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
    const location = nodeLocation(funcDecl!);

    expect(location.startLine).toBe(1);
    expect(location.startColumn).toBe(1);
  });
});
