/**
 * Extract class body members from a class_body AST node.
 *
 * This function extracts properties, functions, nested classes,
 * and constructors from a Java class body.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedConstructor } from '../../../../types.js';
import { extractMethod } from '../function/index.js';
import { extractFields } from '../property/index.js';
import { extractConstructor } from '../constructor/index.js';

/**
 * Result of extracting class body members.
 */
export interface ClassBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
  secondaryConstructors: ParsedConstructor[];
}

/**
 * Function type for extracting a class from a class declaration node.
 * Passed as dependency to avoid circular imports.
 */
export type ClassExtractor = (node: SyntaxNode) => ParsedClass;

/**
 * Extract all members from a Java class body AST node.
 *
 * Java class body can contain:
 * - field_declaration -> properties
 * - method_declaration -> functions
 * - constructor_declaration -> secondaryConstructors
 * - class_declaration, interface_declaration, enum_declaration,
 *   annotation_type_declaration, record_declaration -> nestedClasses
 * - static_initializer, instance_initializer -> ignored for now
 * - enum_constant -> handled in enum-specific extraction
 *
 * @param classBody - The class_body AST node (can be undefined)
 * @param extractClass - Function to extract nested classes (passed to avoid circular dependency)
 * @returns ClassBodyResult with all extracted members
 */
export function extractClassBody(
  classBody: SyntaxNode | undefined,
  extractClass: ClassExtractor
): ClassBodyResult {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];
  const nestedClasses: ParsedClass[] = [];
  const secondaryConstructors: ParsedConstructor[] = [];

  if (!classBody) {
    return { properties, functions, nestedClasses, secondaryConstructors };
  }

  for (const child of classBody.children) {
    switch (child.type) {
      case 'field_declaration':
        // extractFields returns array (Java multi-declarator support)
        properties.push(...extractFields(child));
        break;

      case 'method_declaration':
        functions.push(extractMethod(child));
        break;

      case 'constructor_declaration':
        secondaryConstructors.push(extractConstructor(child));
        break;

      // Nested type declarations
      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
      case 'annotation_type_declaration':
      case 'record_declaration':
        nestedClasses.push(extractClass(child));
        break;

      // Ignored for now
      case 'static_initializer':
      case 'instance_initializer':
      case ';':
      case '{':
      case '}':
        break;
    }
  }

  return { properties, functions, nestedClasses, secondaryConstructors };
}
