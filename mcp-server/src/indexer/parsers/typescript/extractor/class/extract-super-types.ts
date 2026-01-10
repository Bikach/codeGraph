/**
 * Super type extraction for TypeScript parsing.
 *
 * Extracts extends and implements clauses from class and interface declarations.
 *
 * TypeScript AST structure:
 * - class_declaration
 *   - class_heritage
 *     - extends_clause (one class parent)
 *       - type_identifier | generic_type
 *     - implements_clause (multiple interfaces)
 *       - type_identifier | generic_type [, ...]
 *
 * - interface_declaration
 *   - extends_type_clause (multiple interfaces, no implements)
 *     - type_identifier | generic_type [, ...]
 */

import type { SyntaxNode } from 'tree-sitter';
import { findChildByType, extractFullTypeName } from '../ast-utils/index.js';

/**
 * Result of extracting super types from a class or interface declaration.
 */
export interface SuperTypesResult {
  superClass?: string;
  interfaces: string[];
}

/**
 * Extract super types (superclass and interfaces) from a TypeScript class declaration.
 *
 * TypeScript rules:
 * - Class: can extend one class and implement multiple interfaces
 *   Example: class Foo extends Bar implements Baz, Qux {}
 *
 * @param node - The class_declaration node
 * @returns SuperTypesResult with superClass and interfaces arrays
 */
export function extractSuperTypes(node: SyntaxNode): SuperTypesResult {
  const result: SuperTypesResult = { interfaces: [] };

  // TypeScript: class_heritage contains extends_clause and implements_clause
  const heritage = findChildByType(node, 'class_heritage');
  if (!heritage) return result;

  // extends clause (one class parent)
  const extendsClause = findChildByType(heritage, 'extends_clause');
  if (extendsClause) {
    // Find the type identifier/identifier
    const typeNode = extendsClause.children.find((c) => isTypeNode(c));
    // Find type_arguments if present (for generic superclass)
    const typeArgs = findChildByType(extendsClause, 'type_arguments');

    if (typeNode) {
      const baseName = extractFullTypeName(typeNode);
      if (typeArgs) {
        // Combine: Bar + <string> = Bar<string>
        result.superClass = baseName + typeArgs.text;
      } else {
        result.superClass = baseName;
      }
    }
  }

  // implements clause (multiple interfaces)
  const implementsClause = findChildByType(heritage, 'implements_clause');
  if (implementsClause) {
    for (const child of implementsClause.children) {
      // Skip 'implements' keyword and commas
      if (child.type === 'implements' || child.type === ',') continue;

      if (isTypeNode(child)) {
        const typeName = extractFullTypeName(child);
        if (typeName) {
          result.interfaces.push(typeName);
        }
      }
    }
  }

  return result;
}

/**
 * Extract interfaces that an interface extends.
 *
 * TypeScript interfaces can extend multiple other interfaces:
 * - interface Foo extends Bar, Baz {}
 *
 * @param node - The interface_declaration node
 * @returns Array of extended interface names
 */
export function extractInterfaceExtends(node: SyntaxNode): string[] {
  const interfaces: string[] = [];

  // Look for extends_type_clause in interface declarations
  const extendsClause = findChildByType(node, 'extends_type_clause');
  if (!extendsClause) return interfaces;

  for (const child of extendsClause.children) {
    // Skip 'extends' keyword and commas
    if (child.type === 'extends' || child.type === ',') continue;

    if (isTypeNode(child)) {
      const typeName = extractFullTypeName(child);
      if (typeName) {
        interfaces.push(typeName);
      }
    }
  }

  return interfaces;
}

/**
 * Check if a node is a type node that can appear in extends/implements clauses.
 * Note: tree-sitter-typescript sometimes uses 'identifier' instead of 'type_identifier'
 * in extends clauses.
 */
function isTypeNode(node: SyntaxNode): boolean {
  return (
    node.type === 'type_identifier' ||
    node.type === 'identifier' ||
    node.type === 'generic_type' ||
    node.type === 'nested_type_identifier' ||
    node.type === 'member_expression'
  );
}
