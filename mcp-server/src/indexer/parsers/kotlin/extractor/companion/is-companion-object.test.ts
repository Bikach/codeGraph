import { describe, it, expect } from 'vitest';
import { parseKotlin } from '../../parser.js';
import { findChildByType, traverseNode } from '../ast-utils/index.js';
import { isCompanionObject } from './is-companion-object.js';

/**
 * Helper to find an object_declaration node in the AST.
 * Note: In tree-sitter-kotlin, companion objects are parsed as 'companion_object'
 * nodes, NOT 'object_declaration'. This function finds only regular object declarations.
 */
function findObjectDeclaration(code: string): ReturnType<typeof findChildByType> {
  const tree = parseKotlin(code);
  let objectDecl: ReturnType<typeof findChildByType> = undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'object_declaration') {
      objectDecl = node;
      return false; // stop traversal
    }
    return true;
  });
  return objectDecl;
}

/**
 * Helper to find a companion_object node in the AST.
 */
function findCompanionObject(code: string): ReturnType<typeof findChildByType> {
  const tree = parseKotlin(code);
  let companionObj: ReturnType<typeof findChildByType> = undefined;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'companion_object') {
      companionObj = node;
      return false; // stop traversal
    }
    return true;
  });
  return companionObj;
}

describe('isCompanionObject', () => {
  /**
   * Note about tree-sitter-kotlin AST:
   * - Regular objects at top-level or inside classes: 'object_declaration'
   * - Companion objects (with or without name): 'companion_object'
   *
   * The isCompanionObject function checks if an object_declaration has
   * the 'companion' modifier. In practice, tree-sitter-kotlin uses a
   * different node type (companion_object) for companions, so this function
   * would mainly be used as a fallback or for potential edge cases.
   */

  describe('non-companion objects (object_declaration)', () => {
    it('should return false for a regular top-level object declaration', () => {
      const code = `
        object Singleton {
          val instance = "single"
        }
      `;
      const objectDecl = findObjectDeclaration(code);
      expect(objectDecl).not.toBeNull();
      expect(isCompanionObject(objectDecl!)).toBe(false);
    });

    it('should return false for an object with interface implementation', () => {
      const code = `
        object Logger : LoggingStrategy {
          fun log(message: String) {}
        }
      `;
      const objectDecl = findObjectDeclaration(code);
      expect(objectDecl).not.toBeNull();
      expect(isCompanionObject(objectDecl!)).toBe(false);
    });

    it('should return false for an object with properties and functions', () => {
      const code = `
        object Database {
          val connection = "conn"
          fun query(sql: String) = listOf<Any>()
        }
      `;
      const objectDecl = findObjectDeclaration(code);
      expect(objectDecl).not.toBeNull();
      expect(isCompanionObject(objectDecl!)).toBe(false);
    });

    it('should return false for private object', () => {
      const code = `
        private object InternalHelper {
          fun help() {}
        }
      `;
      const objectDecl = findObjectDeclaration(code);
      expect(objectDecl).not.toBeNull();
      expect(isCompanionObject(objectDecl!)).toBe(false);
    });
  });

  describe('companion_object nodes', () => {
    /**
     * In tree-sitter-kotlin, companion objects are parsed as 'companion_object'
     * nodes. While isCompanionObject() is designed to check object_declaration
     * nodes, we verify that calling it on companion_object nodes also returns
     * true since they have the 'companion' child.
     */

    it('should return true for anonymous companion object node', () => {
      const code = `
        class User {
          companion object {
            const val DEFAULT_NAME = "Guest"
          }
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      // The function checks for 'companion' child which companion_object has
      expect(isCompanionObject(companionObj!)).toBe(true);
    });

    it('should return true for named companion object node', () => {
      const code = `
        class User {
          companion object Factory {
            fun create(): User = User()
          }
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      expect(isCompanionObject(companionObj!)).toBe(true);
    });

    it('should return true for companion object with interface implementation', () => {
      const code = `
        class User {
          companion object : Serializable {
            fun fromJson(json: String): User = User()
          }
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      expect(isCompanionObject(companionObj!)).toBe(true);
    });

    it('should return true for private companion object', () => {
      const code = `
        class Config {
          private companion object {
            val SECRET = "secret"
          }
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      expect(isCompanionObject(companionObj!)).toBe(true);
    });

    it('should return true for companion object with annotations', () => {
      const code = `
        class Service {
          @JvmStatic
          companion object {
            fun getInstance(): Service = Service()
          }
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      expect(isCompanionObject(companionObj!)).toBe(true);
    });

    it('should return true for companion object with empty body', () => {
      const code = `
        class Empty {
          companion object
        }
      `;
      const companionObj = findCompanionObject(code);
      expect(companionObj).not.toBeNull();
      expect(isCompanionObject(companionObj!)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle object expression (anonymous object literal)', () => {
      const code = `
        val listener = object : ClickListener {
          override fun onClick() {}
        }
      `;
      // Object expressions have type 'object_literal' not 'object_declaration'
      const tree = parseKotlin(code);
      let objectLiteral: ReturnType<typeof findChildByType> = undefined;
      traverseNode(tree.rootNode, (node) => {
        if (node.type === 'object_literal') {
          objectLiteral = node;
          return false;
        }
        return true;
      });
      // If we find an object_literal, isCompanionObject should return false
      if (objectLiteral) {
        expect(isCompanionObject(objectLiteral)).toBe(false);
      }
    });

    it('should return false for node with no modifiers and no companion child', () => {
      const code = 'object Simple';
      const objectDecl = findObjectDeclaration(code);
      expect(objectDecl).not.toBeNull();
      expect(isCompanionObject(objectDecl!)).toBe(false);
    });
  });
});
