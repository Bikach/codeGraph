import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractModifiers } from './extract-modifiers.js';

describe('extractModifiers', () => {
  describe('visibility', () => {
    it('should extract public visibility (default)', () => {
      const tree = parseKotlin('class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('public');
    });

    it('should extract private visibility', () => {
      const tree = parseKotlin('private class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('private');
    });

    it('should extract protected visibility', () => {
      const tree = parseKotlin('protected class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('protected');
    });

    it('should extract internal visibility', () => {
      const tree = parseKotlin('internal class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('internal');
    });
  });

  describe('class modifiers', () => {
    it('should extract abstract modifier', () => {
      const tree = parseKotlin('abstract class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.isAbstract).toBe(true);
    });

    it('should extract data modifier', () => {
      const tree = parseKotlin('data class User(val name: String)');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.isData).toBe(true);
    });

    it('should extract sealed modifier', () => {
      const tree = parseKotlin('sealed class Result');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.isSealed).toBe(true);
    });
  });

  describe('function modifiers', () => {
    it('should extract suspend modifier', () => {
      const tree = parseKotlin('suspend fun doWork() {}');
      const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
      const modifiers = extractModifiers(funcDecl!);
      expect(modifiers.isSuspend).toBe(true);
    });

    it('should extract inline modifier', () => {
      const tree = parseKotlin('inline fun <reified T> process() {}');
      const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
      const modifiers = extractModifiers(funcDecl!);
      expect(modifiers.isInline).toBe(true);
    });

    it('should extract infix modifier', () => {
      const tree = parseKotlin('infix fun Int.plus(other: Int) = this + other');
      const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
      const modifiers = extractModifiers(funcDecl!);
      expect(modifiers.isInfix).toBe(true);
    });

    it('should extract operator modifier', () => {
      const tree = parseKotlin('operator fun plus(other: Int) = this + other');
      const funcDecl = findChildByType(tree.rootNode, 'function_declaration');
      const modifiers = extractModifiers(funcDecl!);
      expect(modifiers.isOperator).toBe(true);
    });
  });

  describe('combined modifiers', () => {
    it('should extract multiple modifiers', () => {
      const tree = parseKotlin('private abstract class Base');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('private');
      expect(modifiers.isAbstract).toBe(true);
    });

    it('should handle no modifiers', () => {
      const tree = parseKotlin('class User');
      const classDecl = findChildByType(tree.rootNode, 'class_declaration');
      const modifiers = extractModifiers(classDecl!);
      expect(modifiers.visibility).toBe('public');
      expect(modifiers.isAbstract).toBe(false);
      expect(modifiers.isData).toBe(false);
      expect(modifiers.isSealed).toBe(false);
      expect(modifiers.isSuspend).toBe(false);
      expect(modifiers.isInline).toBe(false);
      expect(modifiers.isInfix).toBe(false);
      expect(modifiers.isOperator).toBe(false);
    });
  });
});
