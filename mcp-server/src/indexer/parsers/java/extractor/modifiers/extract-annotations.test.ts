import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractAnnotations } from './extract-annotations.js';
import { findChildByType } from '../ast-utils/index.js';

describe('extractAnnotations', () => {
  function getClassAnnotations(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    return extractAnnotations(classDecl!);
  }

  function getMethodAnnotations(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDecl = findChildByType(classBody!, 'method_declaration');
    return extractAnnotations(methodDecl!);
  }

  it('should extract marker annotation', () => {
    const annotations = getMethodAnnotations('class Test { @Override public void run() {} }');
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Override');
    expect(annotations[0]!.arguments).toBeUndefined();
  });

  it('should extract annotation with single value', () => {
    const annotations = getClassAnnotations('@SuppressWarnings("unchecked") class Test {}');
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('SuppressWarnings');
    expect(annotations[0]!.arguments).toBeDefined();
    expect(annotations[0]!.arguments!['value']).toBe('"unchecked"');
  });

  it('should extract annotation with named arguments', () => {
    const annotations = getMethodAnnotations(
      'class Test { @Deprecated(since = "1.0", forRemoval = true) void old() {} }'
    );
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Deprecated');
    expect(annotations[0]!.arguments).toBeDefined();
    expect(annotations[0]!.arguments!['since']).toBe('"1.0"');
    expect(annotations[0]!.arguments!['forRemoval']).toBe('true');
  });

  it('should extract multiple annotations', () => {
    const annotations = getMethodAnnotations(
      'class Test { @Override @Deprecated public void run() {} }'
    );
    expect(annotations).toHaveLength(2);
    expect(annotations[0]!.name).toBe('Override');
    expect(annotations[1]!.name).toBe('Deprecated');
  });

  it('should return empty array for node without annotations', () => {
    const annotations = getClassAnnotations('class Test {}');
    expect(annotations).toEqual([]);
  });

  it('should extract annotation on class', () => {
    const annotations = getClassAnnotations('@Entity class User {}');
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Entity');
  });

  it('should handle scoped annotation name', () => {
    const annotations = getClassAnnotations('@javax.annotation.Nullable class Test {}');
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Nullable');
  });

  it('should extract annotation with array value', () => {
    const annotations = getClassAnnotations(
      '@SuppressWarnings({"unchecked", "deprecation"}) class Test {}'
    );
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('SuppressWarnings');
  });
});
