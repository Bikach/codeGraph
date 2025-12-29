/**
 * Extract record components from a record declaration.
 *
 * Java records (Java 16+) have components defined in the declaration:
 * `record Point(int x, int y) { }`
 *
 * These components become:
 * - Implicit private final fields
 * - Implicit accessor methods (x(), y())
 * - Part of the canonical constructor
 *
 * We extract them as properties with isVal: true (immutable).
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty, ParsedAnnotation } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';
import { extractAnnotations } from '../modifiers/index.js';

/**
 * Extract record components as properties from a record_declaration node.
 *
 * @param node - The record_declaration AST node
 * @returns Array of ParsedProperty representing the record components
 */
export function extractRecordComponents(node: SyntaxNode): ParsedProperty[] {
  if (node.type !== 'record_declaration') {
    return [];
  }

  const formalParameters = findChildByType(node, 'formal_parameters');
  if (!formalParameters) {
    return [];
  }

  const properties: ParsedProperty[] = [];

  for (const child of formalParameters.children) {
    if (child.type === 'formal_parameter') {
      const property = extractRecordComponent(child);
      if (property) {
        properties.push(property);
      }
    }
  }

  return properties;
}

/**
 * Extract a single record component as a property.
 *
 * AST structure:
 * formal_parameter:
 *   modifiers? (annotations)
 *   type
 *   identifier
 *   dimensions? (for array types)
 */
function extractRecordComponent(node: SyntaxNode): ParsedProperty | undefined {
  // Find the identifier (component name)
  const nameNode = findChildByType(node, 'identifier');
  if (!nameNode) return undefined;

  // Extract type
  const type = extractComponentType(node);

  // Extract annotations from the component
  const annotations = extractComponentAnnotations(node);

  return {
    name: nameNode.text,
    type,
    visibility: 'private', // Record components are implicitly private
    isVal: true, // Record components are implicitly final (immutable)
    annotations,
    location: nodeLocation(node),
  };
}

/**
 * Extract the type from a record component.
 *
 * Handles:
 * - Simple types: int, String
 * - Array types: int[], String[][] (array_type node includes dimensions)
 * - Generic types: List<String> (generic_type node includes type args)
 * - Qualified types: java.util.Date (scoped_type_identifier)
 * - Varargs: String... (last component can be varargs)
 */
function extractComponentType(node: SyntaxNode): string | undefined {
  // Find type node (first non-modifiers, non-identifier child that's a type)
  for (const child of node.children) {
    if (isTypeNode(child)) {
      // Use extractFullTypeName which returns the full text including generics/arrays
      let typeName = extractFullTypeName(child);

      // Check for varargs (spread_parameter wraps the whole thing in some grammars)
      // or ... after the type
      if (node.type === 'spread_parameter' || node.children.some((c) => c.text === '...')) {
        typeName += '...';
      }

      return typeName;
    }
  }

  return undefined;
}

/**
 * Check if a node represents a type.
 *
 * In Java AST, types can be:
 * - type_identifier: Simple type (String)
 * - scoped_type_identifier: Qualified type (java.util.Date)
 * - generic_type: Parameterized type (List<String>)
 * - array_type: Array type (int[])
 * - integral_type: int, long, short, byte, char
 * - floating_point_type: float, double
 * - boolean_type: boolean
 * - void_type: void
 */
function isTypeNode(node: SyntaxNode): boolean {
  const typeNodeTypes = [
    'type_identifier',
    'scoped_type_identifier',
    'generic_type',
    'array_type',
    'integral_type',
    'floating_point_type',
    'boolean_type',
    'void_type',
  ];
  return typeNodeTypes.includes(node.type);
}

/**
 * Extract annotations from a record component.
 *
 * Record component annotations can target:
 * - The field
 * - The accessor method
 * - The constructor parameter
 *
 * We extract all of them as they're part of the component definition.
 */
function extractComponentAnnotations(node: SyntaxNode): ParsedAnnotation[] {
  // extractAnnotations looks for 'modifiers' child with annotations
  // For formal_parameter, annotations may be directly on the node or in modifiers
  return extractAnnotations(node);
}
