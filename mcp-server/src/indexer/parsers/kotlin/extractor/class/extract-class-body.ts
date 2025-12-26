/**
 * Extract class body members from a class_body AST node.
 *
 * This function extracts properties, functions, nested classes, companion objects,
 * and secondary constructors from a Kotlin class body.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedConstructor } from '../../../../types.js';
import { extractProperty } from '../property/index.js';
import { extractFunction } from '../function/index.js';
import { extractSecondaryConstructor } from '../constructor/index.js';
import { isCompanionObject } from '../companion/index.js';

/**
 * Result of extracting class body members.
 */
export interface ClassBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
  companionObject?: ParsedClass;
  secondaryConstructors: ParsedConstructor[];
}

/**
 * Function type for extracting a class from a class declaration node.
 * Passed as dependency to avoid circular imports.
 */
export type ClassExtractor = (node: SyntaxNode) => ParsedClass;

/**
 * Function type for extracting a companion object.
 * Passed as dependency to avoid circular imports.
 */
export type CompanionObjectExtractor = (node: SyntaxNode) => ParsedClass;

/**
 * Extract all members from a class body AST node.
 *
 * @param classBody - The class_body or enum_class_body AST node (can be undefined)
 * @param extractClass - Function to extract nested classes (passed to avoid circular dependency)
 * @param extractCompanionObject - Function to extract companion objects (passed to avoid circular dependency)
 * @returns ClassBodyResult with all extracted members
 */
export function extractClassBody(
  classBody: SyntaxNode | undefined,
  extractClass: ClassExtractor,
  extractCompanionObject: CompanionObjectExtractor
): ClassBodyResult {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];
  const nestedClasses: ParsedClass[] = [];
  const secondaryConstructors: ParsedConstructor[] = [];
  let companionObject: ParsedClass | undefined = undefined;

  if (!classBody) {
    return { properties, functions, nestedClasses, companionObject, secondaryConstructors };
  }

  for (const child of classBody.children) {
    switch (child.type) {
      case 'property_declaration':
        properties.push(extractProperty(child));
        break;

      case 'function_declaration':
        functions.push(extractFunction(child));
        break;

      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_class_declaration':
        nestedClasses.push(extractClass(child));
        break;

      case 'object_declaration':
        // Check if this is a companion object
        if (isCompanionObject(child)) {
          companionObject = extractClass(child);
        } else {
          nestedClasses.push(extractClass(child));
        }
        break;

      case 'companion_object':
        companionObject = extractCompanionObject(child);
        break;

      case 'secondary_constructor':
        secondaryConstructors.push(extractSecondaryConstructor(child));
        break;
    }
  }

  return { properties, functions, nestedClasses, companionObject, secondaryConstructors };
}
