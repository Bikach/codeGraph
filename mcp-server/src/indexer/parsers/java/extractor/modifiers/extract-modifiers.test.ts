import { describe, it, expect } from 'vitest';
import { parseJava } from '../../parser.js';
import { extractModifiers } from './extract-modifiers.js';
import { findChildByType } from '../ast-utils/index.js';

describe('extractModifiers', () => {
  function getClassModifiers(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    return extractModifiers(classDecl!);
  }

  function getMethodModifiers(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const methodDecl = findChildByType(classBody!, 'method_declaration');
    return extractModifiers(methodDecl!);
  }

  function getFieldModifiers(code: string) {
    const tree = parseJava(code);
    const classDecl = findChildByType(tree.rootNode, 'class_declaration');
    const classBody = findChildByType(classDecl!, 'class_body');
    const fieldDecl = findChildByType(classBody!, 'field_declaration');
    return extractModifiers(fieldDecl!);
  }

  describe('visibility', () => {
    it('should extract public visibility', () => {
      const modifiers = getClassModifiers('public class User {}');
      expect(modifiers.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const modifiers = getFieldModifiers('class Test { private int value; }');
      expect(modifiers.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const modifiers = getMethodModifiers('class Test { protected void run() {} }');
      expect(modifiers.visibility).toBe('protected');
    });

    it('should default to internal (package-private) when no visibility', () => {
      const modifiers = getClassModifiers('class User {}');
      expect(modifiers.visibility).toBe('internal');
    });
  });

  describe('class modifiers', () => {
    it('should extract abstract modifier', () => {
      const modifiers = getClassModifiers('public abstract class Shape {}');
      expect(modifiers.isAbstract).toBe(true);
    });

    it('should extract final modifier', () => {
      const modifiers = getClassModifiers('public final class Constants {}');
      expect(modifiers.isFinal).toBe(true);
    });

    it('should extract static modifier for nested class', () => {
      const tree = parseJava('class Outer { static class Inner {} }');
      const outerClass = findChildByType(tree.rootNode, 'class_declaration');
      const classBody = findChildByType(outerClass!, 'class_body');
      const innerClass = findChildByType(classBody!, 'class_declaration');
      const modifiers = extractModifiers(innerClass!);
      expect(modifiers.isStatic).toBe(true);
    });
  });

  describe('method modifiers', () => {
    it('should extract synchronized modifier', () => {
      const modifiers = getMethodModifiers('class Test { public synchronized void run() {} }');
      expect(modifiers.isSynchronized).toBe(true);
    });

    it('should extract native modifier', () => {
      const modifiers = getMethodModifiers('class Test { public native void nativeMethod(); }');
      expect(modifiers.isNative).toBe(true);
    });

    it('should extract static modifier', () => {
      const modifiers = getMethodModifiers('class Test { public static void main(String[] args) {} }');
      expect(modifiers.isStatic).toBe(true);
    });

    it('should extract final modifier', () => {
      const modifiers = getMethodModifiers('class Test { public final void run() {} }');
      expect(modifiers.isFinal).toBe(true);
    });

    it('should extract abstract modifier', () => {
      const modifiers = getMethodModifiers('abstract class Test { public abstract void run(); }');
      expect(modifiers.isAbstract).toBe(true);
    });
  });

  describe('field modifiers', () => {
    it('should extract final modifier', () => {
      const modifiers = getFieldModifiers('class Test { private final int VALUE = 42; }');
      expect(modifiers.isFinal).toBe(true);
    });

    it('should extract static modifier', () => {
      const modifiers = getFieldModifiers('class Test { public static int count; }');
      expect(modifiers.isStatic).toBe(true);
    });

    it('should extract transient modifier', () => {
      const modifiers = getFieldModifiers('class Test { private transient int temp; }');
      expect(modifiers.isTransient).toBe(true);
    });

    it('should extract volatile modifier', () => {
      const modifiers = getFieldModifiers('class Test { private volatile boolean flag; }');
      expect(modifiers.isVolatile).toBe(true);
    });

    it('should extract multiple modifiers', () => {
      const modifiers = getFieldModifiers('class Test { private static final int VALUE = 42; }');
      expect(modifiers.visibility).toBe('private');
      expect(modifiers.isStatic).toBe(true);
      expect(modifiers.isFinal).toBe(true);
    });
  });

  describe('default values', () => {
    it('should return default modifiers for node without modifiers', () => {
      const tree = parseJava('class Test { int value; }');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const classBody = findChildByType(classDecl!, 'class_body');
      const fieldDecl = findChildByType(classBody!, 'field_declaration');
      const modifiers = extractModifiers(fieldDecl!);

      expect(modifiers.visibility).toBe('internal');
      expect(modifiers.isAbstract).toBe(false);
      expect(modifiers.isFinal).toBe(false);
      expect(modifiers.isStatic).toBe(false);
    });
  });
});
