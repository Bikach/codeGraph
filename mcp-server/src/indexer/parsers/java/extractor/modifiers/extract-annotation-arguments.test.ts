import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractAnnotationArguments } from './extract-annotation-arguments.js';
import { findChildByType } from '../ast-utils/index.js';

describe('extractAnnotationArguments', () => {
  function getAnnotationArgs(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = modifiers?.children.find(
      (c) => c.type === 'annotation' || c.type === 'marker_annotation'
    );
    return annotation ? extractAnnotationArguments(annotation) : undefined;
  }

  it('should return undefined for marker annotation (no args)', () => {
    const args = getAnnotationArgs('@Entity class Test {}');
    expect(args).toBeUndefined();
  });

  it('should extract single value argument', () => {
    const args = getAnnotationArgs('@SuppressWarnings("unchecked") class Test {}');
    expect(args).toBeDefined();
    expect(args!['value']).toBe('"unchecked"');
  });

  it('should extract named arguments', () => {
    const tree = parseJava('class Test { @Deprecated(since = "1.0") void old() {} }');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDecl = findChildByType(classBody!, 'method_declaration');
    const modifiers = findChildByType(methodDecl!, 'modifiers');
    const annotation = modifiers?.children.find((c) => c.type === 'annotation');

    const args = annotation ? extractAnnotationArguments(annotation) : undefined;
    expect(args).toBeDefined();
    expect(args!['since']).toBe('"1.0"');
  });

  it('should extract multiple named arguments', () => {
    const tree = parseJava(
      'class Test { @Deprecated(since = "1.0", forRemoval = true) void old() {} }'
    );
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDecl = findChildByType(classBody!, 'method_declaration');
    const modifiers = findChildByType(methodDecl!, 'modifiers');
    const annotation = modifiers?.children.find((c) => c.type === 'annotation');

    const args = annotation ? extractAnnotationArguments(annotation) : undefined;
    expect(args).toBeDefined();
    expect(args!['since']).toBe('"1.0"');
    expect(args!['forRemoval']).toBe('true');
  });

  it('should handle boolean values', () => {
    const tree = parseJava('class Test { @Deprecated(forRemoval = true) void old() {} }');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDecl = findChildByType(classBody!, 'method_declaration');
    const modifiers = findChildByType(methodDecl!, 'modifiers');
    const annotation = modifiers?.children.find((c) => c.type === 'annotation');

    const args = annotation ? extractAnnotationArguments(annotation) : undefined;
    expect(args!['forRemoval']).toBe('true');
  });
});
