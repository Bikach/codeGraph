/**
 * Extract class property declarations from TypeScript AST.
 *
 * TypeScript class property types:
 * - public_field_definition: public x = 1
 * - field_definition: private x = 1
 * - property_signature: interface property
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation, extractFullTypeName } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractDecorators } from '../decorators/index.js';

/**
 * Extract a class property (field) declaration.
 *
 * public_field_definition structure:
 * public_field_definition > decorator*, accessibility_modifier?, static?, readonly?, property_identifier | private_property_identifier, type_annotation?, =?, initializer?
 */
export function extractClassProperty(node: SyntaxNode): ParsedProperty {
  // Name: property_identifier or private_property_identifier (#private)
  const nameNode =
    findChildByType(node, 'property_identifier') ?? findChildByType(node, 'private_property_identifier');
  const name = nameNode?.text ?? 'unknown';

  const modifiers = extractModifiers(node);
  const decorators = extractDecorators(node);

  // Type
  const typeAnnotation = findChildByType(node, 'type_annotation');
  let type: string | undefined;
  if (typeAnnotation) {
    const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
    type = extractFullTypeName(typeNode);
  }

  // Initial value
  const initializer = findInitializer(node);

  // Private field (#name) -> visibility private
  const isPrivateField = nameNode?.type === 'private_property_identifier';
  const visibility = isPrivateField ? 'private' : modifiers.visibility;

  // Check for readonly
  const isReadonly = modifiers.isReadonly || node.children.some((c) => c.type === 'readonly');

  return {
    name: name.replace(/^#/, ''), // Remove # prefix for consistency
    type,
    visibility,
    isVal: isReadonly, // readonly maps to isVal (immutable)
    initializer: initializer?.text,
    annotations: decorators,
    location: nodeLocation(node),
  };
}

/**
 * Extract a property signature from an interface.
 */
export function extractPropertySignature(node: SyntaxNode): ParsedProperty {
  const nameNode = findChildByType(node, 'property_identifier');
  const name = nameNode?.text ?? 'unknown';

  const typeAnnotation = findChildByType(node, 'type_annotation');
  let type: string | undefined;
  if (typeAnnotation) {
    const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
    type = extractFullTypeName(typeNode);
  }

  // Check for readonly
  const isReadonly = node.children.some((c) => c.type === 'readonly');

  // Note: optional (?) is tracked but not currently exposed in ParsedProperty
  // const _isOptional = node.children.some((c) => c.type === '?');

  return {
    name,
    type,
    visibility: 'public', // Interface properties are always public
    isVal: isReadonly,
    initializer: undefined, // Interface properties don't have initializers
    annotations: [],
    location: nodeLocation(node),
  };
}

/**
 * Find the initializer value in a property declaration.
 * The initializer follows the = sign.
 */
function findInitializer(node: SyntaxNode): SyntaxNode | undefined {
  let foundEquals = false;
  for (const child of node.children) {
    if (foundEquals) {
      return child;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }
  return undefined;
}
