import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractAnnotations } from './extract-annotations.js';

describe('extractAnnotations', () => {
  it('should return empty array for node without annotations', () => {
    const tree = parseKotlin('class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    const annotations = extractAnnotations(classDecl!);
    expect(annotations).toEqual([]);
  });

  it('should extract single annotation', () => {
    const tree = parseKotlin('@Deprecated class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    const annotations = extractAnnotations(classDecl!);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Deprecated');
  });

  it('should extract multiple annotations', () => {
    const tree = parseKotlin('@Deprecated @Suppress("UNCHECKED_CAST") class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    const annotations = extractAnnotations(classDecl!);
    expect(annotations).toHaveLength(2);
    expect(annotations[0]!.name).toBe('Deprecated');
    expect(annotations[1]!.name).toBe('Suppress');
  });

  it('should extract annotation with arguments', () => {
    const tree = parseKotlin('@Deprecated("use NewClass") class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');

    const annotations = extractAnnotations(classDecl!);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Deprecated');
    expect(annotations[0]!.arguments).toBeDefined();
    expect(annotations[0]!.arguments!['_0']).toBe('"use NewClass"');
  });

  it('should extract function annotations', () => {
    const tree = parseKotlin('@Test fun testSomething() {}');
    const funcDecl = findChildByType(tree.rootNode, 'function_declaration');

    const annotations = extractAnnotations(funcDecl!);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Test');
  });

  it('should extract property annotations', () => {
    const tree = parseKotlin('@Inject val service: Service = Service()');
    const propDecl = findChildByType(tree.rootNode, 'property_declaration');

    const annotations = extractAnnotations(propDecl!);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Inject');
  });

  it('should handle annotations without arguments returning undefined arguments', () => {
    const tree = parseKotlin('@Override fun toString() = "test"');
    const funcDecl = findChildByType(tree.rootNode, 'function_declaration');

    const annotations = extractAnnotations(funcDecl!);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]!.name).toBe('Override');
    expect(annotations[0]!.arguments).toBeUndefined();
  });
});
