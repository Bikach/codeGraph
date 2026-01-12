/**
 * Extract mapped types from TypeScript object_type nodes containing index_signature with mapped_type_clause.
 *
 * TypeScript mapped types:
 * - type Readonly<T> = { readonly [K in keyof T]: T[K] }
 * - type Partial<T> = { [K in keyof T]?: T[K] }
 * - type Record<K, V> = { [P in K]: V }
 * - type Mutable<T> = { -readonly [K in keyof T]: T[K] }
 * - type Required<T> = { [K in keyof T]-?: T[K] }
 * - type Remapped<T> = { [K in keyof T as NewKey]: T[K] }
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedMappedType, ParsedMappedTypeModifier } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Check if a type node represents a mapped type.
 * A mapped type is an object_type containing an index_signature with a mapped_type_clause.
 */
export function isMappedType(typeNode: SyntaxNode): boolean {
  if (typeNode.type !== 'object_type') {
    return false;
  }

  const indexSignature = findChildByType(typeNode, 'index_signature');
  if (!indexSignature) {
    return false;
  }

  return findChildByType(indexSignature, 'mapped_type_clause') !== undefined;
}

/**
 * Extract a mapped type from an object_type node.
 *
 * AST structure for `{ readonly [K in keyof T]: T[K] }`:
 * object_type >
 *   index_signature >
 *     readonly (optional)
 *     mapped_type_clause >
 *       type_identifier (key name, e.g., 'K')
 *       in
 *       index_type_query (optional, for 'keyof T') >
 *         keyof
 *         type_identifier
 *       type_identifier (or other type for constraint)
 *       as (optional)
 *       <type> (remapped key type)
 *     type_annotation (or opting_type_annotation for ?, or omitting_type_annotation for -?)
 */
export function extractMappedType(objectTypeNode: SyntaxNode): ParsedMappedType | undefined {
  if (objectTypeNode.type !== 'object_type') {
    return undefined;
  }

  const indexSignature = findChildByType(objectTypeNode, 'index_signature');
  if (!indexSignature) {
    return undefined;
  }

  const mappedTypeClause = findChildByType(indexSignature, 'mapped_type_clause');
  if (!mappedTypeClause) {
    return undefined;
  }

  // Extract key name (first type_identifier in mapped_type_clause)
  const keyNameNode = findChildByType(mappedTypeClause, 'type_identifier');
  const keyName = keyNameNode?.text ?? 'K';

  // Extract constraint and check for keyof
  const { constraint, hasKeyof } = extractConstraint(mappedTypeClause);

  // Extract as clause if present
  const asClause = extractAsClause(mappedTypeClause);

  // Extract value type from type_annotation variants
  const valueType = extractValueType(indexSignature);

  // Extract modifiers
  const modifiers = extractModifiers(indexSignature);

  return {
    keyName,
    constraint,
    hasKeyof,
    valueType,
    asClause,
    modifiers,
  };
}

/**
 * Extract the constraint from a mapped_type_clause.
 * Handles both `K in keyof T` and `K in T`.
 */
function extractConstraint(mappedTypeClause: SyntaxNode): { constraint: string; hasKeyof: boolean } {
  const indexTypeQuery = findChildByType(mappedTypeClause, 'index_type_query');

  if (indexTypeQuery) {
    // Has keyof: "keyof T" - extract the type after keyof
    const keyofTarget = findChildByType(indexTypeQuery, 'type_identifier');
    return {
      constraint: keyofTarget?.text ?? indexTypeQuery.text.replace(/^keyof\s*/, ''),
      hasKeyof: true,
    };
  }

  // No keyof: find the type after 'in' keyword
  let foundIn = false;
  let foundFirstTypeId = false;
  for (const child of mappedTypeClause.children) {
    if (child.type === 'in') {
      foundIn = true;
      continue;
    }
    if (!foundIn) {
      // Skip the first type_identifier (it's the key name)
      if (child.type === 'type_identifier') {
        foundFirstTypeId = true;
      }
      continue;
    }
    // Found 'in', now look for the constraint type
    if (child.type === 'as') {
      // Stop at 'as' clause
      break;
    }
    if (child.type === 'type_identifier' || isTypeNode(child)) {
      return {
        constraint: child.text,
        hasKeyof: false,
      };
    }
  }

  return { constraint: '', hasKeyof: false };
}

/**
 * Check if a node represents a type expression.
 */
function isTypeNode(node: SyntaxNode): boolean {
  const typeNodeTypes = [
    'type_identifier',
    'generic_type',
    'union_type',
    'intersection_type',
    'literal_type',
    'predefined_type',
    'parenthesized_type',
    'template_literal_type',
    'conditional_type',
  ];
  return typeNodeTypes.includes(node.type);
}

/**
 * Extract the 'as' clause for key remapping if present.
 * Example: `[K in keyof T as Uppercase<K>]` -> returns "Uppercase<K>"
 */
function extractAsClause(mappedTypeClause: SyntaxNode): string | undefined {
  let foundAs = false;
  for (const child of mappedTypeClause.children) {
    if (child.type === 'as') {
      foundAs = true;
      continue;
    }
    if (foundAs && isTypeNode(child)) {
      return child.text;
    }
  }
  return undefined;
}

/**
 * Extract the value type from the index signature.
 * Handles: type_annotation, opting_type_annotation (?:), omitting_type_annotation (-?:)
 */
function extractValueType(indexSignature: SyntaxNode): string {
  // Try all annotation variants
  const annotationTypes = ['type_annotation', 'opting_type_annotation', 'omitting_type_annotation'];

  for (const annotationType of annotationTypes) {
    const annotation = findChildByType(indexSignature, annotationType);
    if (annotation) {
      // The value type is the child type node after the colon/operator
      for (const child of annotation.children) {
        if (isTypeNode(child) || child.type === 'lookup_type' || child.type === 'function_type') {
          return child.text;
        }
      }
      // Fallback: extract text after the colon
      const match = annotation.text.match(/^[?-]*:\s*(.+)$/);
      return match?.[1] ?? '';
    }
  }

  return '';
}

/**
 * Extract modifiers from the index signature.
 * Handles: readonly, +readonly, -readonly, ?, +?, -?
 */
function extractModifiers(indexSignature: SyntaxNode): ParsedMappedTypeModifier[] {
  const modifiers: ParsedMappedTypeModifier[] = [];

  // Track if we found a '-' for readonly
  let pendingMinus = false;
  let pendingPlus = false;

  for (const child of indexSignature.children) {
    if (child.type === '+') {
      pendingPlus = true;
      continue;
    }
    if (child.type === '-') {
      pendingMinus = true;
      continue;
    }
    if (child.type === 'readonly') {
      modifiers.push({
        kind: 'readonly',
        prefix: pendingMinus ? '-' : pendingPlus ? '+' : undefined,
      });
      pendingMinus = false;
      pendingPlus = false;
      continue;
    }
    if (child.type === '[') {
      // Reset pending modifiers when we hit the bracket
      pendingMinus = false;
      pendingPlus = false;
      continue;
    }
  }

  // Check for optional modifiers in annotation types
  const optingAnnotation = findChildByType(indexSignature, 'opting_type_annotation');
  if (optingAnnotation) {
    modifiers.push({
      kind: 'optional',
      prefix: undefined,
    });
  }

  const omittingAnnotation = findChildByType(indexSignature, 'omitting_type_annotation');
  if (omittingAnnotation) {
    modifiers.push({
      kind: 'optional',
      prefix: '-',
    });
  }

  return modifiers;
}
