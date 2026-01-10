/**
 * Extract a class from a TypeScript class_declaration AST node.
 *
 * This is the main function for extracting class declarations in TypeScript.
 *
 * TypeScript class structure:
 * - class_declaration
 *   - decorator*                  # @Decorator
 *   - abstract?                   # abstract keyword
 *   - class                       # keyword
 *   - type_identifier             # ClassName
 *   - type_parameters?            # <T, U>
 *   - class_heritage?
 *     - extends_clause            # extends Parent
 *     - implements_clause         # implements IFoo, IBar
 *   - class_body
 *     - method_definition
 *     - field_definition
 *     - constructor_declaration
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractDecorators } from '../decorators/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { mapClassKind, isAbstractClass } from './map-class-kind.js';
import { extractSuperTypes } from './extract-super-types.js';
import { extractClassBody } from './extract-class-body.js';

/**
 * Extract a class declaration from a TypeScript AST node.
 *
 * @param node - The class_declaration or abstract_class_declaration node
 * @returns ParsedClass representing the extracted class
 */
export function extractClass(node: SyntaxNode): ParsedClass {
  const kind = mapClassKind(node);

  // Find class name
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract modifiers and decorators
  const modifiers = extractModifiers(node);
  const decorators = extractDecorators(node);

  // Check for abstract (explicit check for both patterns)
  const isAbstract = isAbstractClass(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Extract super types (extends/implements)
  const { superClass, interfaces } = extractSuperTypes(node);

  // Extract body members
  const classBody = findChildByType(node, 'class_body');
  const recursiveExtractClass = (n: SyntaxNode): ParsedClass => extractClass(n);
  const { properties, functions, nestedClasses } = extractClassBody(classBody, recursiveExtractClass);

  return {
    name,
    kind,
    visibility: modifiers.visibility,
    isAbstract,
    isData: false, // TypeScript doesn't have data classes
    isSealed: false, // TypeScript doesn't have sealed classes
    superClass,
    interfaces,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: decorators,
    properties,
    functions,
    nestedClasses,
    companionObject: undefined, // TypeScript doesn't have companion objects
    secondaryConstructors: undefined, // TypeScript classes have single constructor
    location: nodeLocation(node),
  };
}
