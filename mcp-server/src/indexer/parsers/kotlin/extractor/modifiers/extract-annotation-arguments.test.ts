import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractAnnotationArguments } from './extract-annotation-arguments.js';

describe('extractAnnotationArguments', () => {
  it('should return undefined for annotation without arguments', () => {
    const tree = parseKotlin('@Deprecated class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = findChildByType(modifiers!, 'annotation');

    const args = extractAnnotationArguments(annotation!);
    expect(args).toBeUndefined();
  });

  it('should extract positional argument', () => {
    const tree = parseKotlin('@Deprecated("use NewClass") class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = findChildByType(modifiers!, 'annotation');

    const args = extractAnnotationArguments(annotation!);
    expect(args).toBeDefined();
    expect(args!['_0']).toBe('"use NewClass"');
  });

  it('should extract named argument', () => {
    const tree = parseKotlin('@Deprecated(message = "use NewClass") class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = findChildByType(modifiers!, 'annotation');

    const args = extractAnnotationArguments(annotation!);
    expect(args).toBeDefined();
    expect(args!['message']).toBe('"use NewClass"');
  });

  it('should extract multiple named arguments', () => {
    const tree = parseKotlin('@Deprecated(message = "old", replaceWith = ReplaceWith("new")) class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = findChildByType(modifiers!, 'annotation');

    const args = extractAnnotationArguments(annotation!);
    expect(args).toBeDefined();
    expect(args!['message']).toBe('"old"');
    expect(args!['replaceWith']).toContain('ReplaceWith');
  });

  it('should extract multiple positional arguments', () => {
    const tree = parseKotlin('@SomeAnnotation("first", "second") class User');
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const modifiers = findChildByType(classDecl!, 'modifiers');
    const annotation = findChildByType(modifiers!, 'annotation');

    const args = extractAnnotationArguments(annotation!);
    expect(args).toBeDefined();
    expect(args!['_0']).toBe('"first"');
    expect(args!['_1']).toBe('"second"');
  });
});
