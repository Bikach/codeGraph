/**
 * Extract companion object from a companion_object AST node.
 *
 * Companion objects in Kotlin are singleton objects defined inside a class
 * that can hold static-like members.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedConstructor } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';

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
 * Function type for extracting class body members.
 * Passed as dependency to avoid circular imports.
 */
export type ClassBodyExtractor = (classBody: SyntaxNode | undefined) => ClassBodyResult;

/**
 * Extract a companion object from a companion_object AST node.
 *
 * @param node - The companion_object AST node
 * @param extractClassBody - Function to extract class body members (passed to avoid circular dependency)
 * @returns ParsedClass representing the companion object
 */
export function extractCompanionObject(
  node: SyntaxNode,
  extractClassBody: ClassBodyExtractor
): ParsedClass {
  // companion_object has similar structure to object_declaration
  const nameNode = findChildByType(node, 'type_identifier') ?? findChildByType(node, 'simple_identifier');
  const name = nameNode?.text ?? 'Companion';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  const classBody = findChildByType(node, 'class_body');
  const { properties, functions, nestedClasses } = extractClassBody(classBody);

  return {
    name,
    kind: 'object',
    visibility: modifiers.visibility,
    isAbstract: false,
    isData: false,
    isSealed: false,
    superClass: undefined,
    interfaces: [],
    annotations,
    properties,
    functions,
    nestedClasses,
    location: nodeLocation(node),
  };
}
