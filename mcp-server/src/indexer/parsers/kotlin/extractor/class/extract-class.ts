/**
 * Extract a class, interface, object, enum, or annotation from an AST node.
 *
 * This is the main function for extracting class-like declarations in Kotlin.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractPrimaryConstructorProperties } from '../constructor/index.js';
import { mapClassKind, extractSuperTypes } from './index.js';
import { extractClassBody } from './extract-class-body.js';
import type { CompanionObjectExtractor } from './extract-class-body.js';

/**
 * Extract a class-like declaration from an AST node.
 *
 * Handles: class_declaration, interface_declaration, object_declaration,
 * enum_class_declaration, annotation_declaration
 *
 * @param node - The AST node representing the class-like declaration
 * @param extractCompanionObject - Function to extract companion objects (passed to avoid circular dependency)
 * @returns ParsedClass representing the extracted class
 */
export function extractClass(
  node: SyntaxNode,
  extractCompanionObject: CompanionObjectExtractor
): ParsedClass {
  const kind = mapClassKind(node);
  const nameNode =
    node.childForFieldName('name') ??
    findChildByType(node, 'type_identifier') ??
    findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Extract super types (delegation_specifier nodes are direct children of class_declaration)
  const { superClass, interfaces } = extractSuperTypes(node);

  // Extract primary constructor properties
  const primaryConstructorProps = extractPrimaryConstructorProperties(node);

  // Extract body members
  // Create a recursive extractClass that captures extractCompanionObject
  const recursiveExtractClass = (n: SyntaxNode): ParsedClass => extractClass(n, extractCompanionObject);

  const classBody = findChildByType(node, 'class_body') ?? findChildByType(node, 'enum_class_body');
  const { properties, functions, nestedClasses, companionObject, secondaryConstructors } = extractClassBody(
    classBody,
    recursiveExtractClass,
    extractCompanionObject
  );

  // Merge primary constructor properties with body properties
  const allProperties = [...primaryConstructorProps, ...properties];

  return {
    name,
    kind,
    visibility: modifiers.visibility,
    isAbstract: modifiers.isAbstract,
    isData: modifiers.isData,
    isSealed: modifiers.isSealed,
    superClass,
    interfaces,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    properties: allProperties,
    functions,
    nestedClasses,
    companionObject,
    secondaryConstructors: secondaryConstructors.length > 0 ? secondaryConstructors : undefined,
    location: nodeLocation(node),
  };
}
