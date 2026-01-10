/**
 * Extract class body members from a class_body AST node.
 *
 * This function extracts properties, functions, and nested classes
 * from a TypeScript class body.
 *
 * TypeScript class body can contain:
 * - public_field_definition: public property
 * - field_definition: property with possible access modifier
 * - method_definition: method with implementation
 * - abstract_method_signature: abstract method
 * - class_declaration: nested class
 * - interface_declaration: nested interface
 * - enum_declaration: nested enum
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty } from '../../../../types.js';
import { extractClassProperty } from '../property/index.js';
import { extractMethod } from '../function/index.js';

/**
 * Result of extracting class body members.
 */
export interface ClassBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
}

/**
 * Function type for extracting a class from a class declaration node.
 * Passed as dependency to avoid circular imports.
 */
export type ClassExtractor = (node: SyntaxNode) => ParsedClass;

/**
 * Extract all members from a TypeScript class body AST node.
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

  if (!classBody) {
    return { properties, functions, nestedClasses };
  }

  for (const child of classBody.children) {
    switch (child.type) {
      // Property definitions
      case 'public_field_definition':
      case 'field_definition':
        properties.push(extractClassProperty(child));
        break;

      // Method definitions
      case 'method_definition':
        functions.push(extractMethod(child));
        break;

      // Abstract method signatures
      case 'abstract_method_signature':
        functions.push(extractMethod(child));
        break;

      // Getter/setter (treat as methods for now)
      case 'getter_declaration':
      case 'setter_declaration':
        functions.push(extractMethod(child));
        break;

      // Nested type declarations
      case 'class_declaration':
      case 'abstract_class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
        nestedClasses.push(extractClass(child));
        break;

      // Constructor - will be handled separately in extract-class.ts
      case 'constructor_declaration':
        // Constructors are not part of ClassBodyResult
        // They will be extracted by the main extractClass function
        break;

      // Static blocks (TypeScript 4.4+)
      case 'static_block':
        // Ignored for now
        break;

      // Punctuation and comments
      case ';':
      case '{':
      case '}':
      case 'comment':
        break;
    }
  }

  return { properties, functions, nestedClasses };
}
