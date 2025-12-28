/**
 * Extract a class, interface, enum, annotation, or record from an AST node.
 *
 * This is the main function for extracting class-like declarations in Java.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { mapClassKind, isRecordDeclaration } from './map-class-kind.js';
import { extractSuperTypes } from './extract-super-types.js';
import { extractClassBody } from './extract-class-body.js';

/**
 * Extract a class-like declaration from an AST node.
 *
 * Handles:
 * - class_declaration
 * - interface_declaration
 * - enum_declaration
 * - annotation_type_declaration
 * - record_declaration (Java 16+)
 *
 * @param node - The AST node representing the class-like declaration
 * @returns ParsedClass representing the extracted class
 */
export function extractClass(node: SyntaxNode): ParsedClass {
  const kind = mapClassKind(node);
  const isRecord = isRecordDeclaration(node);

  // Find the name - different node types have different structures
  const nameNode = findChildByType(node, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Extract super types (extends/implements)
  const { superClass, interfaces } = extractSuperTypes(node);

  // Extract body members
  const bodyNode = findClassBody(node);
  const recursiveExtractClass = (n: SyntaxNode): ParsedClass => extractClass(n);
  const { properties, functions, nestedClasses, secondaryConstructors } = extractClassBody(
    bodyNode,
    recursiveExtractClass
  );

  // For records: extract properties from record components (TODO Phase 4)
  // For now, properties will be empty for records

  return {
    name,
    kind,
    visibility: modifiers.visibility,
    isAbstract: modifiers.isAbstract,
    isData: isRecord, // Records are mapped to isData: true
    isSealed: modifiers.isSealed,
    superClass,
    interfaces,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    properties,
    functions,
    nestedClasses,
    companionObject: undefined, // Java doesn't have companion objects
    secondaryConstructors: secondaryConstructors.length > 0 ? secondaryConstructors : undefined,
    location: nodeLocation(node),
  };
}

/**
 * Find the class body node for different declaration types.
 *
 * Different declaration types have different body node types:
 * - class_declaration -> class_body
 * - interface_declaration -> interface_body
 * - enum_declaration -> enum_body
 * - annotation_type_declaration -> annotation_type_body
 * - record_declaration -> class_body (or record_body in some grammar versions)
 */
function findClassBody(node: SyntaxNode): SyntaxNode | undefined {
  return (
    findChildByType(node, 'class_body') ??
    findChildByType(node, 'interface_body') ??
    findChildByType(node, 'enum_body') ??
    findChildByType(node, 'annotation_type_body') ??
    findChildByType(node, 'record_body')
  );
}
