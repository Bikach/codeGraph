/**
 * Extract field declarations from Java AST.
 *
 * Java specificity: Multiple variables can be declared in one statement:
 *   private int a, b, c = 5;
 * This becomes 3 separate ParsedProperty objects.
 *
 * final fields map to isVal: true (immutable)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, findChildrenByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extract field declarations from a field_declaration node.
 *
 * Java AST structure:
 * field_declaration:
 *   modifiers?
 *   type
 *   variable_declarator (, variable_declarator)*
 *   ;
 *
 * variable_declarator:
 *   identifier dimensions? (= initializer)?
 *
 * @param node - The field_declaration AST node
 * @returns Array of ParsedProperty (one per variable declarator)
 */
export function extractFields(node: SyntaxNode): ParsedProperty[] {
  const fields: ParsedProperty[] = [];

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // final -> isVal: true
  const isVal = modifiers.isFinal ?? false;

  // Find base type
  const typeNode = findTypeNode(node);
  const baseType = typeNode ? extractFullTypeName(typeNode) : undefined;

  // Find all variable declarators
  const declarators = findChildrenByType(node, 'variable_declarator');

  for (const declarator of declarators) {
    const field = extractSingleField(declarator, {
      baseType,
      visibility: modifiers.visibility,
      isVal,
      annotations,
      declarationLocation: nodeLocation(node),
    });
    if (field) fields.push(field);
  }

  return fields;
}

interface FieldContext {
  baseType: string | undefined;
  visibility: ParsedProperty['visibility'];
  isVal: boolean;
  annotations: ParsedProperty['annotations'];
  declarationLocation: ParsedProperty['location'];
}

/**
 * Extract a single field from a variable_declarator.
 *
 * Handles:
 * - Simple: int x
 * - With initializer: int x = 5
 * - Array dimensions: int[] x or int x[]
 */
function extractSingleField(
  declarator: SyntaxNode,
  context: FieldContext
): ParsedProperty | undefined {
  const nameNode = findChildByType(declarator, 'identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;

  // Handle array dimensions after variable name: int x[][]
  const dimensions = findChildrenByType(declarator, 'dimensions');
  let type = context.baseType;
  if (dimensions.length > 0 && type) {
    type = type + dimensions.map(() => '[]').join('');
  }

  // Extract initializer if present
  const initNode = declarator.children.find((c) => c.type === '=');
  let initializer: string | undefined;
  if (initNode) {
    // Everything after '=' is the initializer
    const initIndex = declarator.children.indexOf(initNode);
    const initParts: string[] = [];
    for (let i = initIndex + 1; i < declarator.children.length; i++) {
      const child = declarator.children[i];
      if (child && child.type !== ',' && child.type !== ';') {
        initParts.push(child.text);
      }
    }
    initializer = initParts.join('').trim() || undefined;
  }

  return {
    name,
    type,
    visibility: context.visibility,
    isVal: context.isVal,
    initializer,
    annotations: context.annotations,
    location: context.declarationLocation,
  };
}

/**
 * Find the type node in a field declaration.
 */
function findTypeNode(node: SyntaxNode): SyntaxNode | undefined {
  return (
    findChildByType(node, 'generic_type') ??
    findChildByType(node, 'array_type') ??
    findChildByType(node, 'type_identifier') ??
    findChildByType(node, 'scoped_type_identifier') ??
    findChildByType(node, 'integral_type') ??
    findChildByType(node, 'floating_point_type') ??
    findChildByType(node, 'boolean_type')
  );
}
