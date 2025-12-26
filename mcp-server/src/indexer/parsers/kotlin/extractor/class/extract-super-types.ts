/**
 * Super type extraction for Kotlin parsing.
 */

import type { SyntaxNode } from 'tree-sitter';
import { findChildByType, extractTypeName } from '../ast-utils/index.js';

/**
 * Result of extracting super types from a class declaration.
 */
export interface SuperTypesResult {
  superClass?: string;
  interfaces: string[];
}

/**
 * Extract super types (superclass and interfaces) from a class declaration.
 *
 * In Kotlin, a superclass has constructor invocation (parentheses),
 * while interfaces don't.
 *
 * Example: class User : BaseEntity(), Serializable, Comparable<User>
 *          BaseEntity() -> superclass (has parentheses)
 *          Serializable, Comparable<User> -> interfaces (no parentheses)
 */
export function extractSuperTypes(classNode: SyntaxNode): SuperTypesResult {
  let superClass: string | undefined;
  const interfaces: string[] = [];

  // delegation_specifier nodes are direct children of class_declaration
  // In Kotlin: superclass has constructor invocation (parentheses), interfaces don't
  // Example: class User : BaseEntity(), Serializable, Comparable<User>
  //          BaseEntity() -> superclass (has parentheses = constructor_invocation)
  //          Serializable, Comparable<User> -> interfaces (no parentheses = user_type only)
  for (const child of classNode.children) {
    if (child.type === 'delegation_specifier') {
      const constructorInvocation = findChildByType(child, 'constructor_invocation');
      const userType = findChildByType(child, 'user_type');

      if (constructorInvocation) {
        // This is a superclass (has constructor call with parentheses)
        // constructor_invocation contains user_type for the class name
        const typeNode = findChildByType(constructorInvocation, 'user_type');
        const typeName = typeNode ? extractTypeName(typeNode) : extractTypeName(constructorInvocation);
        if (typeName && !superClass) {
          // Only take the first one as superclass (Kotlin allows only one)
          superClass = typeName;
        } else if (typeName) {
          // Additional constructor invocations are rare but possible (delegation)
          interfaces.push(typeName);
        }
      } else if (userType) {
        // This is an interface (no constructor call)
        const typeName = extractTypeName(userType);
        if (typeName) {
          interfaces.push(typeName);
        }
      }
    }
  }

  return { superClass, interfaces };
}
