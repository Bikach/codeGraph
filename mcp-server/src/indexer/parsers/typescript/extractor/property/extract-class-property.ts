/**
 * Extract a property from a TypeScript class member.
 *
 * TypeScript class property types:
 * - public_field_definition: public x = 1
 * - field_definition: private x = 1
 * - property_signature: interface property
 *
 * This is a minimal implementation for Phase 4.
 * Full implementation will come in Phase 5.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation, extractFullTypeName } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';

/**
 * Extract a property from a class field definition.
 */
export function extractClassProperty(node: SyntaxNode): ParsedProperty {
  const modifiers = extractModifiers(node);

  // Find property name
  const nameNode =
    findChildByType(node, 'property_identifier') ?? findChildByType(node, 'private_property_identifier');
  const name = nameNode?.text ?? '<unknown>';

  // Find type annotation
  const typeAnnotation = findChildByType(node, 'type_annotation');
  let type: string | undefined;
  if (typeAnnotation) {
    // type_annotation > : type
    const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
    type = extractFullTypeName(typeNode);
  }

  // Check for initializer
  const initializer = node.children.find(
    (c) => c.type === 'string' || c.type === 'number' || c.type === 'call_expression' || c.type === 'new_expression'
  );

  // Check for readonly modifier
  const isReadonly = modifiers.isReadonly || node.children.some((c) => c.type === 'readonly');

  return {
    name,
    type,
    visibility: modifiers.visibility,
    isVal: isReadonly, // readonly in TypeScript maps to val
    initializer: initializer?.text,
    annotations: [], // Decorators on properties will be added in Phase 5
    location: nodeLocation(node),
  };
}

/**
 * Extract a property from an interface property signature.
 */
export function extractPropertySignature(node: SyntaxNode): ParsedProperty {
  const nameNode = findChildByType(node, 'property_identifier');
  const name = nameNode?.text ?? '<unknown>';

  // Check for optional marker (?)
  const isOptional = node.children.some((c) => c.type === '?');

  // Find type annotation
  const typeAnnotation = findChildByType(node, 'type_annotation');
  let type: string | undefined;
  if (typeAnnotation) {
    const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
    type = extractFullTypeName(typeNode);
  }

  // Check for readonly
  const isReadonly = node.children.some((c) => c.type === 'readonly');

  return {
    name: isOptional ? `${name}?` : name, // Include optional marker in name for now
    type,
    visibility: 'public', // Interface properties are always public
    isVal: isReadonly,
    initializer: undefined,
    annotations: [],
    location: nodeLocation(node),
  };
}
